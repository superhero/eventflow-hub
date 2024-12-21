import assert from 'node:assert/strict'
import { suite, test } from 'node:test'
import SubscribersManager from '@superhero/eventflow-hub/manager/subscribers'

suite('@superhero/eventflow-hub/manager/subscribers', () =>
{
  test('Add and retrieve subscribers', async () =>
  {
    const manager = new SubscribersManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1, 'domain1', 'event1')
    manager.add(socket2, 'domain1', 'event1')

    const subscribers = manager.get('domain1', 'event1')
    assert.deepStrictEqual(subscribers, [socket1, socket2])
  })

  test('Handle wildcard subscribers', async () =>
  {
    const manager = new SubscribersManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1, 'domain1', '*')
    manager.add(socket2, 'domain1', 'event1')

    const subscribers = manager.get('domain1', 'event1')
    assert.deepStrictEqual(subscribers, [socket2, socket1])
  })

  test('Return empty array if no subscribers exist', async () =>
  {
    const manager = new SubscribersManager()
    const subscribers = manager.get('domain1', 'event1')
    assert.deepStrictEqual(subscribers, [])
  })

  test('Delete a subscriber and clean up empty structures', async () =>
  {
    const manager = new SubscribersManager()
    const socket1 = { id: 'socket1' }
    const socket2 = { id: 'socket2' }

    manager.add(socket1, 'domain1', 'event1')
    manager.add(socket2, 'domain1', 'event1')

    manager.deleteBySocket(socket1)

    let subscribers = manager.get('domain1', 'event1')
    assert.deepStrictEqual(subscribers, [socket2])

    manager.deleteBySocket(socket2)
    subscribers = manager.get('domain1', 'event1')
    assert.deepStrictEqual(subscribers, [])
  })

  test('Clean up domain and event mappings after deletion', async () =>
  {
    const manager = new SubscribersManager()
    const socket = { id: 'socket1' }

    manager.add(socket, 'domain1', 'event1')
    manager.deleteBySocket(socket)

    assert.strictEqual(manager.get('domain1', 'event1').length, 0)
    assert.strictEqual(manager.get('domain1', '*').length, 0)
  })

  test('Not throw errors when deleting non-existent subscribers', async () =>
  {
    const manager = new SubscribersManager()
    const socket = { id: 'socket1' }

    assert.doesNotThrow(() => manager.deleteBySocket(socket))
  })
})
