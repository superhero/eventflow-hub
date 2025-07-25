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

  async destroy()
  {
    for(const socket of this.all)
    {
      await new Promise(resolve =>
      {
        socket.once('close', resolve)
        socket.end()
      })
    }

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