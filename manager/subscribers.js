/**
 * Manage subscribers to events by event domain and event name
 * @memberof Eventflow.Hub
 */
export default class SubscribersManager
{
  #map = new Map

  destroy()
  {
    this.#map.clear()
  }

  add(socket, domain, name)
  {
    if(false === this.#map.has(domain))
    {
      this.#map.set(domain, new Map)
    }

    if(false === this.#map.get(domain).has(name))
    {
      this.#map.get(domain).set(name, new Set)
    }

    this.#map.get(domain).get(name).add(socket)
  }

  get(domain, name)
  {
    const
      domainMap   = this.#map.get(domain) || new Map,
      namedSet    = domainMap.get(name)   || new Set,
      wildcardSet = domainMap.get('*')    || new Set

    return [...new Set([...namedSet, ...wildcardSet])]
  }

  deleteBySocket(socket)
  {
    for(const domain of this.#map.keys())
    {
      for(const name of this.#map.get(domain).keys())
      {
        this.#map.get(domain).get(name).delete(socket)

        if(0 === this.#map.get(domain).get(name).size)
        {
          this.#map.get(domain).delete(name)

          if(0 === this.#map.get(domain).size)
          {
            this.#map.delete(domain)
          }
        }
      }
    }
  }

  deleteBySocketAndDomainAndName(socket, domain, name)
  {
    const 
      domainMap = this.#map.get(domain) || new Map,
      namedSet  = domainMap.get(name)   || new Set

    namedSet.delete(socket)

    if(0 === namedSet.size)
    {
      domainMap.delete(name)

      if(0 === domainMap.size)
      {
        this.#map.delete(domain)
      }
    }
  }
}