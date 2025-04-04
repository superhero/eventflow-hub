import tls                  from 'node:tls'
import deepmerge            from '@superhero/deep/merge'
import Channel              from '@superhero/tcp-record-channel'
import IdNameGenerator      from '@superhero/id-name-generator'
import Log                  from '@superhero/log'
import SpokesManager        from '@superhero/eventflow-hub/manager/spokes'
import SubscribersManager   from '@superhero/eventflow-hub/manager/subscribers'
import CertificatesManager  from '@superhero/eventflow-certificates'
import { setInterval as asyncInterval } from 'node:timers/promises'

const sleep = (ms) => new Promise((accept) => setTimeout(accept, ms))

export function locate(locator)
{
  const
    certificates  = locator.config.find('eventflow/certificates', {}),
    config        = locator.config.find('eventflow/hub', { certificates }),
    db            = locator.locate('@superhero/eventflow-db'),
    hub           = new Hub(config, db)

  return hub
}

/**
 * @memberof Eventflow
 */
export default class Hub
{
  #hubID

  abortion    = new AbortController()
  channel     = new Channel()
  spokes      = new SpokesManager()
  subscribers = new SubscribersManager()

  get hubID()
  {
    return this.#hubID
  }

  constructor(config, db)
  {
    if('string' !== typeof config.NAME
    || 0 === config.NAME.length
    || (/[^a-z0-9\-\.]/i).test(config.NAME))
    {
      const error = new Error(`invalid config.NAME (${config.NAME})`)
      error.code  = 'E_EVENTFLOW_HUB_INVALID_CONFIG_NAME'
      throw error
    }

    this.#hubID       = (config.NAME + '.' + new IdNameGenerator().generateId()).toUpperCase()
    this.config       = config
    this.db           = db
    this.log          = new Log({ label: `[EVENTFLOW:HUB:${this.#hubID}]` })
    this.certificates = new CertificatesManager(config.NAME, this.#hubID, config.certificates, db)

    for(const level of [ 'info', 'warn', 'fail' ])
    {
      this.log[level] = (...args) => 
      {
        this.log.emit(level, ...args)
        return this.log.basic(...args)
      }
    }

    this.channel.on('record', this.#onRecord.bind(this))
  }

  async bootstrap()
  {
    await this.db.setupTableSchemas()
    await this.#bootstrapServer()
    setImmediate(this.#sheduledInterval.bind(this, this.config.SHEDULED_INTERVAL_DELAY))
  }

  async destroy()
  {
    const reason = new Error('hub is destroyed')
    reason.code  = 'E_EVENTFLOW_HUB_DESTROYED'

    this.abortion.abort(reason)
    this.server?.close()

    for(const socket of this.spokes.all)
    {
      socket.end()
    }

    this.spokes.destroy()
    this.subscribers.destroy()
    this.log.warn`destroyed`
    await this.db.updateHubToQuit(this.#hubID)
    await sleep(1e3)
    await this.db.close()
  }

  #bootstrapServer()
  {
    return new Promise(async (accept, reject) =>
    {
      const conf = Object.assign({}, this.config.TCP_SOCKET_SERVER_OPTIONS)

      conf.requestCert    = true
      conf.pauseOnConnect = true
      conf.SNICallback    = this.#serverSNICallback.bind(this)

      this.server = this.channel.createTlsServer(conf, this.#onClientConnection.bind(this))
      this.server.on('error', reject)
      this.server.on('close', reject)
      this.server.listen(this.config.INTERNAL_PORT, this.config.INTERNAL_IP, async () =>
      {
        this.server.off('error', reject)
        this.server.off('close', reject)

        this.server.on('error', this.#onServerError.bind(this))
        this.server.on('close', this.#onServerClose.bind(this))

        this.log.info`listen on ${this.config.INTERNAL_IP}:${this.config.INTERNAL_PORT}`

        await this.#persistHubOnline()
        await this.#broadcastHubOnlineToPeerHubs()

        accept()
      })
    })
  }

  async #serverSNICallback(hostname, cb)
  {
    if(hostname !== this.#hubID)
    {
      const error = new Error('invalid hostname')
      error.code  = 'E_EVENTFLOW_INVALID_HOSTNAME'
      error.cause = `hostname ${hostname} mismatch with hub id ${this.#hubID}`
      return cb(error)
    }

    try
    {
      const
        root = await this.certificates.root,
        ica  = await this.certificates.intermediate,
        leaf = await this.certificates.leaf
  
      const ctx = tls.createSecureContext(
      {
        ca          : root.cert,
        cert        : leaf.cert + ica.cert,
        key         : leaf.key,
        passphrase  : leaf.pass
      })

      cb(null, ctx)
    }
    catch(error)
    {
      return cb(error)
    }
  }

  async #onServerError(error)
  {
    const message = this.log.fail`server error [${error.code}] ${error.message}`
    await this.db.persistLog({ agent:this.#hubID, message, error })
  }

  async #onClientError(client, error)
  {
    const message = this.log.fail`observed client error [${error.code}] ${error.message} in ${client.id}`
    await this.db.persistLog({ agent:this.#hubID, message, error })
  }

  async #onServerClose()
  {
    this.log.warn`server closed`
  }

  async #persistHubOnline()
  {
    const
      internal_ip   = this.config.INTERNAL_IP,
      internal_port = this.config.INTERNAL_PORT,
      external_ip   = this.config.EXTERNAL_IP,
      external_port = this.config.EXTERNAL_PORT

    await this.db.persistHub({ id:this.#hubID, internal_ip, internal_port, external_ip, external_port })
  }

  async #onClientConnection(client)
  {
    if(false === client.authorized)
    {
      this.log.warn`unauthorized client connection rejected`
      return client.authorized = false
    }

    this.spokes.add(client)

    client.id         = client.getPeerCertificate().subject.UID
    client.authorized = true

    client.on('close', this.#onClientDisconnected.bind(this, client))
    client.on('error', this.#onClientError.bind(this, client))

    client.setKeepAlive(true, this.config.KEEP_ALIVE_INTERVAL)
    client.resume()

    const message = this.log.info`connected ${client.id}`
    await this.db.persistLog({ agent:this.#hubID, message })
  }

  async #onClientDisconnected(client)
  {
    this.spokes.delete(client)
    this.subscribers.deleteBySocket(client)
    const message = this.log.info`disconnected ${client.id}`
    await this.db.persistLog({ agent:this.#hubID, message })
  }

  /**
   * @see @superhero/tcp-record-channel
   * @param {String[]} record The unit seperated record
   * @param {node:tls.TLSSocket} client A spoke or peer hub client
   */
  async #onRecord([ event, ...args ], client)
  {
    switch(event)
    {
      case 'online'      : return this.#onPeerHubOnlineMessage    (client, ...args)
      case 'publish'     : return this.#onSpokePublishMessage     (client, ...args)
      case 'subscribe'   : return this.#onSpokeSubscribeMessage   (client, ...args)
      case 'unsubscribe' : return this.#onSpokeUnsubscribeMessage (client, ...args)
      // only recognize the above listed events
      default: this.log.fail`observed invalid message ${event} from spoke ${client.id}`
    }
  }

  /**
   * Broadcasts the online status of a peer hub to all connected spokes of this hub.
   * The intent is to inform all connected spokes that a peer hub is online so that 
   * they can connect to that hub as well. Spokes are not expected to poll for online
   * hubs, but rather rely on a reactional architecture.
   * 
   * @param {node:tls.TLSSocket} peerHub
   * @param {string} peerHubID
   * @param {string} peerHubIP 
   * @param {string} peerHubPort
   */
  async #onPeerHubOnlineMessage(peerHub, peerHubID, peerHubIP, peerHubPort)
  {
    // prevent possible loop
    if(peerHubID === this.#hubID)
    {
      return
    }

    try
    {
      this.channel.broadcast(this.spokes.all, [ 'online', peerHubID, peerHubIP, peerHubPort ])
    }
    catch(error)
    {
      this.log.fail`failed to broadcast peer hub ${peerHubID} online event [${error.code}] ${error.message}`
      return
    }

    this.log.info`broadcasted peer hub ${peerHubID} › ${peerHubIP}:${peerHubPort} online event`
  }

  #onSpokeSubscribeMessage(spoke, domain, name)
  {
    this.subscribers.add(spoke, domain, name)
    this.log.info`spoke ${spoke.id} subscribes to events: ${domain} › ${name}`
  }

  #onSpokeUnsubscribeMessage(spoke, domain, name)
  {
    this.subscribers.deleteBySocketAndDomainAndName(spoke, domain, name)
    this.log.info`spoke ${spoke.id} unsubscribed to events: ${domain} › ${name}`
  }

  async #onSpokePublishMessage(spoke, domain, id, name, pid)
  {
    this.log.info`spoke ${spoke.id} published event ${id}: ${domain} › ${name} › ${pid}`
    await this.#attemptToConsumeAndBroadcastPublishedMessage(domain, id, name, pid)
  }

  async #attemptToConsumeAndBroadcastPublishedMessage(domain, id, name, pid)
  {
    const consumed = await this.db.updateEventPublishedToConsumedByHub(id, this.#hubID)

    if(consumed)
    {
      this.log.info`consumed event ${id}: ${domain} › ${name} › ${pid}`
      await this.#broadcastPublishedMessage(domain, id, name, pid)
    }

    return consumed
  }

  async #broadcastPublishedMessage(domain, id, name, pid)
  {
    const sockets = this.subscribers.get(domain, name)

    if(sockets.length === 0)
    {
      this.log.warn`observed an orphan event ${id}: ${domain} › ${name} › ${pid}`
      await this.db.updateEventPublishedToOrphan(domain, id)
    }
    else
    {
      try
      {
        this.channel.broadcast(sockets, [ 'publish', domain, id, name, pid ])
      }
      catch(error)
      {
        this.log.fail`failed to broadcast event ${id}: ${domain} › ${name} › ${pid} [${error.code}] ${error.message}`
        return
      }

      this.log.info`broadcasted event ${id}: ${domain} › ${name} › ${pid}`
    }
  }

  async #broadcastHubOnlineToPeerHubs()
  {
    for(const { id:hubID, external_ip:ip, external_port:port } of await this.db.readOnlineHubs())
    {
      // prevent possible loop
      if(hubID === this.#hubID
      || this.abortion.signal.aborted)
      {
        continue
      }

      try
      {
        await this.#transmitHubOnlineToPeerHub(hubID, ip, port)
      }
      catch(error)
      {
        const message = this.log.fail`failed to connect to peer hub ${hubID} [${error.code}] ${error.message}`
        await this.db.persistLog({ agent:this.#hubID, message, error })
        await this.db.updateHubToQuit(hubID)
      }
    }
  }

  async #transmitHubOnlineToPeerHub(servername, host, port)
  {
    const
      rootCA        = await this.certificates.root,
      hubICA        = await this.certificates.intermediate,
      hubLeaf       = await this.certificates.leaf,
      ca            = rootCA.cert,
      cert          = hubLeaf.cert + hubICA.cert,
      key           = hubLeaf.key,
      passphrase    = hubLeaf.pass,
      timeout       = Number(this.config.PEER_HUB_ONLINE_TIMEOUT),
      dynamicConfig = { servername, host, port, ca, cert, key, passphrase, timeout },
      peerHubConfig = deepmerge(dynamicConfig, this.config.TCP_SOCKET_CLIENT_OPTIONS),
      peerHub       = await this.channel.createTlsClient(peerHubConfig)

    peerHub.id = peerHub.getPeerCertificate().subject.UID
    this.channel.transmit(peerHub, [ 'online', this.#hubID, this.config.EXTERNAL_IP, this.config.EXTERNAL_PORT ])
    const message = this.log.info`broadcasted online status to peer hub ${peerHub.id}`
    await this.db.persistLog({ agent:this.#hubID, message })

    peerHub.end()
  }

  /**
   * Polls the database for scheduled events and attempts to execute them.
   * TODO: This method should be refactored to use a more reactive approach.
   * @param {number} delay interval in milliseconds
   */
  async #sheduledInterval(delay)
  {
    const signal = this.abortion.signal

    if(signal.aborted)
    {
      return
    }

    if(0 === this.spokes.amount
    && await this.db.hasHubQuit(this.#hubID))
    {
      const message = this.log.warn`hub was registered as "quit" by peer hub, probably caused by network issues between peer hubs`
      await this.db.persistLog({ agent:this.#hubID, message })
      return await this.destroy()
    }

    try
    {
      const
        readScheduledEvents = this.db.readEventsScheduled.bind(this.db),
        asyncIterator       = asyncInterval(delay, readScheduledEvents, { signal })

      for await (const sheduledEvents of asyncIterator) 
      {
        if(signal.aborted)
        {
          return
        }

        for(const scheduledEvent of await sheduledEvents())
        {
          if(signal.aborted)
          {
            return
          }

          const { domain, id, name } = scheduledEvent
          const executed = await this.db.updateEventScheduledExecuted(domain, id)
    
          if(executed === false)
          {
            continue
          }

          let consumed
  
          try 
          {
            this.log.info`executed scheduled event ${id}: ${domain} › ${name}`
            consumed = await this.#attemptToConsumeAndBroadcastPublishedMessage(domain, id, name)
          }
          catch (error)
          {
            const message = this.log.fail`failed to execute scheduled event ${id}: ${domain} › ${name} [${error.code}] ${error.message}`
            await this.db.updateEventScheduledFailed(domain, id)
            await this.db.persistLog({ agent:this.#hubID, message, error })
            throw error
          }
  
          if(consumed)
          {
            await this.db.updateEventScheduledSuccess(domain, id)
          }
          else
          {
            const message = this.log.fail`failed to execute already consumed scheduled event ${id}: ${domain} › ${name}`
            await this.db.updateEventScheduledFailed(domain, id)
            await this.db.persistLog({ agent:this.#hubID, message, error })
          }
        }
      }
    }
    catch(error)
    {
      const message = this.log.fail`failed to execute scheduled interval ${error.message} [${error.code}]`
      await this.db.persistLog({ agent:this.#hubID, message, error })
    }
    finally
    {
      setImmediate(this.#sheduledInterval.bind(this, delay))
    }
  }
}