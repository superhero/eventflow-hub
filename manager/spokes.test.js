import assert           from 'node:assert/strict'
import { suite, test }  from 'node:test'
import SpokesManager    from '@superhero/eventflow-hub/manager/spokes'

suite('@superhero/eventflow-hub/manager/spokes', () =>
{
  test('Add and retrieve all sockets', async () =>
  {
    const manager = new SpokesManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1)
    manager.add(socket2)

    const allSockets = manager.all
    assert.deepStrictEqual(allSockets, [socket1, socket2])
  })

  test('Delete a socket', async () =>
  {
    const manager = new SpokesManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1)
    manager.add(socket2)
    manager.delete(socket1)

    const allSockets = manager.all
    assert.deepStrictEqual(allSockets, [socket2])
  })

  test('Destroy all sockets', async () =>
  {
    const manager = new SpokesManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1)
    manager.add(socket2)
    manager.destroy()

    assert.strictEqual(manager.all.length, 0)
  })

  test('Handle deleting non-existent socket gracefully', async () =>
  {
    const manager = new SpokesManager()
    const socket = { id: 'socket1' }

    assert.doesNotThrow(() =>
    {
      manager.delete(socket)
    })
  })

  test('Return empty array if no sockets exist', async () =>
  {
    const manager = new SpokesManager()

    const allSockets = manager.all
    assert.deepStrictEqual(allSockets, [])
  })
})
