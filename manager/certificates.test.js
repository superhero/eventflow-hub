import Config               from '@superhero/config'
import Log                  from '@superhero/log'
import Locator              from '@superhero/locator'
import { locate }           from '@superhero/eventflow-db'
import CertificatesManager  from '@superhero/eventflow-hub/manager/certificates'
import assert               from 'node:assert/strict'
import { X509Certificate }  from 'node:crypto'
import { suite, test, before, after } from 'node:test'

suite('@superhero/eventflow-hub/manager/certificates', async () =>
{
  const 
    config  = new Config(),
    locator = new Locator()

  locator.set('@superhero/config', config)
  await config.add('@superhero/eventflow-db')

  const db = locate(locator)

  let conf, manager, icaUID = 'intermediate-cert-id', leafUID = 'leaf-cert-id'

  before(() =>
  {
    conf =
    {
      CERT_PASS_ENCRYPTION_KEY  : 'encryptionKey123',
      CERT_ROOT_DAYS            : 365,
      CERT_INTERMEDIATE_DAYS    : 30,
      CERT_LEAF_DAYS            : 7,
      CERT_ALGORITHM            : 'rsa',
      CERT_HASH                 : 'sha256'
    }

    const log = new Log({ label: `[${leafUID}]` })
    log.config.mute = true
    manager = new CertificatesManager(icaUID, leafUID, conf, db, log)
  })

  after(() => db.close())

  test('Throw error if CERT_PASS_ENCRYPTION_KEY is missing in config', () =>
  {
    delete conf.CERT_PASS_ENCRYPTION_KEY
    assert.throws(
      () => new CertificatesManager(icaUID, leafUID, conf, db), 
      { code: 'E_EVENTFLOW_CERTIFICATES_MISSING_CONFIGURATION' })
  })

  test('Get root certificate', async (sub) =>
  {
    const root = await manager.root

    assert.ok(root.validity > Date.now())
    assert.ok(root.cert)
    assert.ok(root.key)
    assert.ok(root.pass)

    const rootX509 = new X509Certificate(root.cert)
    assert.ok(rootX509.checkIssued(rootX509))

    await sub.test('Get same root certificate each time lazyloading it', async () =>
    {
      const root2 = await manager.root
      assert.deepEqual(root, root2)
    })

    await sub.test('Get intermediate certificate', async (sub) =>
    {
      const ica = await manager.intermediate
  
      assert.ok(ica.validity > Date.now())
      assert.ok(ica.cert)
      assert.ok(ica.key)
      assert.ok(ica.pass)
  
      const icaX509 = new X509Certificate(ica.cert)
      assert.ok(icaX509.checkIssued(rootX509))

      await sub.test('Get leaf certificate', async (sub) =>
      {
        const leaf = await manager.leaf
    
        assert.ok(leaf.validity > Date.now())
        assert.ok(leaf.cert)
        assert.ok(leaf.key)
        assert.ok(leaf.pass)
    
        const leafX509 = new X509Certificate(leaf.cert)
        assert.ok(leafX509.checkIssued(icaX509))

        await sub.test('Clear cache and still get the same certificates', async (sub) =>
        {
          manager.clearCache()

          const
            root2 = await manager.root,
            ica2  = await manager.intermediate,
            leaf2 = await manager.leaf

          assert.deepEqual(root, root2)
          assert.deepEqual(ica, ica2)
          assert.deepEqual(leaf, leaf2)
        })

        await sub.test('Revoke certificate and regenerate when expired', async () =>
        {
          await assert.doesNotReject(manager.revoke(leafUID))

          const
            leaf      = await manager.leaf,
            leafX509  = new X509Certificate(leaf.cert)

          assert.ok(leafX509.checkIssued(icaX509))
        })
      })
    })
  })
})
