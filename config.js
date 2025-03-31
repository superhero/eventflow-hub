/**
 * @memberof Eventflow.Hub
 */
export default
{
  bootstrap  : { '@superhero/eventflow-hub' : true },
  dependency : 
  {
    '@superhero/eventflow-certificates'     : true,
    '@superhero/eventflow-db'               : true
  },
  locator    : { '@superhero/eventflow-hub' : true },
  destroy    : { '@superhero/eventflow-db'  : false },
  eventflow  :
  {
    hub:
    {
      NAME                      : process.env.EVENTFLOW_HUB_NAME                      ?? 'EVENTFLOW-HUB',
      SIGNAL_QUIT               : process.env.EVENTFLOW_HUB_SIGNAL_QUIT               ?? 'SIGTERM',
      INTERNAL_IP               : process.env.EVENTFLOW_HUB_INTERNAL_IP               ?? '127.0.0.1',
      INTERNAL_PORT             : process.env.EVENTFLOW_HUB_INTERNAL_PORT             ?? 50001,
      EXTERNAL_IP               : process.env.EVENTFLOW_HUB_EXTERNAL_IP               ?? '127.0.0.1',
      EXTERNAL_PORT             : process.env.EVENTFLOW_HUB_EXTERNAL_PORT             ?? 50001,
      TCP_SOCKET_SERVER_OPTIONS : process.env.EVENTFLOW_HUB_TCP_SOCKET_SERVER_OPTIONS ?? {},
      TCP_SOCKET_CLIENT_OPTIONS : process.env.EVENTFLOW_HUB_TCP_SOCKET_CLIENT_OPTIONS ?? {},
      PEER_HUB_ONLINE_TIMEOUT   : process.env.EVENTFLOW_HUB_PEER_HUB_ONLINE_TIMEOUT   ?? 5e3,
      KEEP_ALIVE_INTERVAL       : process.env.EVENTFLOW_HUB_KEEP_ALIVE_INTERVAL       ?? 60e3,
      SHEDULED_INTERVAL_DELAY   : process.env.EVENTFLOW_HUB_SHEDULED_INTERVAL_DELAY   ?? 1e3
    }
  }
}