/**
 * Manage spoke sockets.
 * @memberof Eventflow.Hub
 */
export default class SpokesManager
{
  #set = new Set

  get amount()
  {
    return this.#set.size
  }

  destroy()
  {
    this.#set.clear()
  }

  add(socket)
  {
    this.#set.add(socket)
  }

  get all()
  {
    return [...this.#set]
  }

  delete(socket)
  {
    this.#set.delete(socket)
  }
}