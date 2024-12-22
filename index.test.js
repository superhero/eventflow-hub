import assert  from 'node:assert'
import util    from 'node:util'
import Config  from '@superhero/config'
import Locator from '@superhero/locator'
import Channel from '@superhero/tcp-record-channel'
import { suite, test, beforeEach, afterEach } from 'node:test'

util.inspect.defaultOptions.depth = 5

suite('@superhero/eventflow-hub', () => 
{
  let locator, hub

  beforeEach(async () => 
  {
    if(beforeEach.skip) return
    locator = new Locator()
    locator.log.config.mute = true
    const config = new Config()
    await config.add('@superhero/eventflow-db')
    await config.add('./config.js')
    config.assign({ eventflow: { hub: { certificates: { CERT_PASS_ENCRYPTION_KEY: 'encryptionKey123' }}}})
    locator.set('@superhero/config', config)
    await locator.eagerload('@superhero/eventflow-db')
    await locator.eagerload(config.find('locator'))
    hub = locator('@superhero/eventflow-hub')
    hub.log.config.mute = true
    await hub.bootstrap()
  })

  afterEach(async () => 
  {
    if(afterEach.skip) return
    await locator.destroy()
    locator.clear()
  })

  suite('Lifecycle', () => 
  {
    test('Can initialize EventflowHub correctly', () => 
    {
      assert.strictEqual(hub.config.NAME, 'EVENTFLOW-HUB')
      assert.ok(hub.channel)
      assert.ok(hub.certificates)
      assert.ok(hub.spokes)
      assert.ok(hub.subscribers)
      assert.strictEqual(hub.config.INTERNAL_IP, '127.0.0.1')
      assert.strictEqual(hub.config.INTERNAL_PORT, 50001)
    })
  })

  suite('Connections and Communication', () => 
  {
    test('Handles spoke connections', async (sub) => 
    {
      assert.equal(hub.spokes.all.length, 0)

      const 
        root    = await hub.certificates.root,
        ica     = await hub.certificates.intermediate,
        leaf    = await hub.certificates.leaf,
        chain   = leaf.cert + ica.cert,
        host    = hub.config.INTERNAL_IP, 
        port    = hub.config.INTERNAL_PORT,
        config  = { servername:hub.hubID, host, port, cert:chain, key:leaf.key, ca:root.cert, passphrase:leaf.pass },
        channel = new Channel(),
        spoke   = await channel.createTlsClient(config)

      assert.ok(hub.spokes.all.length)

      beforeEach.skip = true
      afterEach.skip  = true

      await sub.test('Broadcasts peer hub online event', async () => await new Promise(async (accept) => 
      {
        channel.on('record', ([ type, id ,, port ]) => 'online'   === type 
                                                    && hub2.hubID === id
                                                    && '50002'    === port 
                                                    && hub2.destroy().then(accept))

        const 
          locator2  = new Locator(),
          config2   = new Config()

        locator2.log.config.mute = true
        await config2.add('@superhero/eventflow-db')
        await config2.add('./config.js')
        config2.assign(
        { eventflow:
          { hub:
            { INTERNAL_PORT:50002,
              EXTERNAL_PORT:50002,
              certificates:
              { CERT_PASS_ENCRYPTION_KEY: 'encryptionKey123' }}}})

        locator2.set('@superhero/config', config2)
        await locator2.eagerload('@superhero/eventflow-db')
        await locator2.eagerload(config2.find('locator'))
        const hub2 = locator2('@superhero/eventflow-hub')
        hub2.log.config.mute = true
        await hub2.bootstrap()
      }))

      beforeEach.skip = false
      afterEach.skip  = false

      await new Promise((accept) => spoke.end(accept))
    })
  })
})
