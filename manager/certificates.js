import crypto     from 'node:crypto'
import OpenSSL    from '@superhero/openssl'
import deepassign from '@superhero/deep/assign'

/**
 * @memberof Eventflow.Hub
 */
export default class CertificatesManager
{
  #db
  #log
  #map    = new Map()
  openSSL = new OpenSSL()
  config  =
  {
    CERT_ALGORITHM              : OpenSSL.ALGO.EdDSAEd448,
    CERT_HASH                   : OpenSSL.HASH.SHA512,
    CERT_ROOT_DAYS              : 365,
    CERT_INTERMEDIATE_DAYS      : 30,
    CERT_LEAF_DAYS              : 7,
    CERT_PASS_CIPHER            : 'aes-256-gcm',
    CERT_PASS_PBKDF2_HASH       : 'sha512',
    CERT_PASS_PBKDF2_BYTES      : 32,
    CERT_PASS_PBKDF2_ITERATIONS : 1e6
  }

  constructor(intermediateUID, leafUID, config, db, log)
  {
    this.intermediateUID  = intermediateUID
    this.leafUID          = leafUID
    this.#db              = db
    this.#log             = log

    deepassign(this.config, config)

    if(false === !!this.config.CERT_PASS_ENCRYPTION_KEY)
    {
      const error = new Error('missing configured certification password encryption key')
      error.code  = 'E_EVENTFLOW_CERTIFICATES_MISSING_CONFIGURATION'
      error.cause = 'The encryption key is required to encrypt and decrypt the certificates password and private key'
      throw error
    }
  }

  clearCache()
  {
    this.#map.clear()
  }

  /**
   * Persist a specific certificate by ID in the database.
   * 
   * @param {string} id       the certificate identifier
   * @param {string} validity the validity expiration date of the certificate
   * @param {string} cert     the certificate
   * @param {string} key      the certificate private key
   * @param {string} pass     the certificate private key password
   * 
   * @returns {Promise<boolean>} true if the certificate was persisted, false if it already exists
   */
  perist(id, validity, cert, key, pass)
  {
    const
      encryptionKey = this.config.CERT_PASS_ENCRYPTION_KEY,
      encryptedKey  = this.#encrypt(encryptionKey, key),
      encryptedPass = this.#encrypt(encryptionKey, pass)

    return this.#db.persistCertificate(
    {
      id,
      validity,
      cert,
      // Encrypted Certificate Private Key
      key       : encryptedKey.encrypted,
      key_salt  : encryptedKey.salt,
      key_iv    : encryptedKey.iv,
      key_tag   : encryptedKey.tag,
      // Encrypted Certificate Private Key Password
      pass      : encryptedPass.encrypted,
      pass_salt : encryptedPass.salt,
      pass_iv   : encryptedPass.iv,
      pass_tag  : encryptedPass.tag
    })
  }

  /**
   * Revoke a specific certificate by ID in the database.
   * @param {string} id the certificate identifier
   * @returns {Promise<boolean>} true if the certificate was revoked, false if it does not exist
   */
  revoke(id)
  {
    return this.#db.revokeCertificate(id)
  }

  /**
   * The root certificate authority (CA).
   * @returns {Promise<{cert:string, key:string, pass:string}>}
   */
  get root()
  {
    return this.#lazyload('EVENTFLOW-ROOT-CA', this.#createRoot.bind(this))
  }

  /**
   * The intermediate certificate authority (ICA).
   * @returns {Promise<{cert:string, key:string, pass:string}>}
   */
  get intermediate()
  {
    return this.#lazyload(this.intermediateUID, this.#createIntermediate.bind(this))
  }

  /**
   * The leaf end-entity certificate.
   * @returns {Promise<{cert:string, key:string, pass:string}>}
   */
  get leaf()
  {
    return this.#lazyload(this.leafUID, this.#createLeaf.bind(this))
  }

  async #lazyload(id, factory)
  {
    if(false === this.#map.has(id))
    {
      try
      {
        this.#map.set(id, await this.#readCertificate(id))
      }
      catch(error)
      {
        if('E_EVENTFLOW_DB_CERTIFICATE_NOT_FOUND' === error.code)
        {
          this.#map.set(id, await this.#eagerload(id, factory))
        }
        else
        {
          throw error
        }
      }

      this.#log.info`certificate loaded ${id}`
    }

    const crt = this.#map.get(id)

    if(Date.now() > crt.validity)
    {
      this.#log.warn`certificate expired ${id}`
      this.#map.delete(id)
      await this.#db.revokeCertificate(id)
      return this.#lazyload(id, factory)
    }
    else
    {
      return crt
    }
  }

  async #readCertificate(id)
  {
    const { cert,     key,  key_iv,  key_salt,  key_tag, 
            validity, pass, pass_iv, pass_salt, pass_tag } = await this.#db.readCertificate(id)
    const
      encryptionKey = this.config.CERT_PASS_ENCRYPTION_KEY,
      encryptedPass = { encrypted:pass, salt:pass_salt, iv:pass_iv, tag:pass_tag },
      encryptedKey  = { encrypted:key,  salt:key_salt,  iv:key_iv,  tag:key_tag  },
      decryptedPass = this.#decrypt(encryptionKey, encryptedPass),
      decryptedKey  = this.#decrypt(encryptionKey, encryptedKey)

    return { validity, cert, key:decryptedKey, pass:decryptedPass }
  }

  async #eagerload(id, factory)
  {
    const
      keyPass       = this.#generateRandomPassword(),
      certificate   = await factory(id, keyPass)

    const { cert, key } = certificate
    const
      x509          = new crypto.X509Certificate(certificate.cert),
      validity      = x509.validToDate,
      isPersisted   = await this.perist(id, validity, cert, key, keyPass)

    // If multiple replicas tries at the same time to creater the certificate, 
    // then only the first one to persist is valid, the rest should throw away 
    // the work they done and instead read what is persisted in the database.
    if(isPersisted)
    {
      return { validity, cert, key, pass:keyPass }
    }
    else
    {
      // If the certificate was not persisted, then it was already created 
      // by another replica. We should then read the persisted certificate
      // from the database, and return it instead of what has been generated.
      return await this.#readCertificate(id)
    }
  }

  #createRoot(UID, password)
  {
    return this.openSSL.root(
    {
      days      : this.config.CERT_ROOT_DAYS,
      algorithm : this.config.CERT_ALGORITHM,
      hash      : this.config.CERT_HASH,
      subject   : { UID },
      password
    })
  }

  async #createIntermediate(UID, password)
  {
    const root = await this.root
    return await this.openSSL.intermediate(root, 
    {
      days      : this.config.CERT_INTERMEDIATE_DAYS,
      algorithm : this.config.CERT_ALGORITHM,
      hash      : this.config.CERT_HASH,
      dns       : [ '.' + UID ],
      subject   : { UID },
      password  :
      {
        input   : root.pass,
        output  : password
      }
    })
  }

  async #createLeaf(UID, password)
  {
    const ica = await this.intermediate
    return await this.openSSL.leaf(ica,
    {
      days      : this.config.CERT_LEAF_DAYS,
      algorithm : this.config.CERT_ALGORITHM,
      hash      : this.config.CERT_HASH,
      dns       : [ this.leafUID ],
      subject   : { UID },
      password  :
      {
        input   : ica.pass,
        output  : password
      }
    })
  }

  #encrypt(password, decrypted)
  {
    const
      cipher      = this.config.CERT_PASS_CIPHER,
      hash        = this.config.CERT_PASS_PBKDF2_HASH,
      bytes       = this.config.CERT_PASS_PBKDF2_BYTES,
      iterations  = this.config.CERT_PASS_PBKDF2_ITERATIONS,
      salt        = crypto.randomBytes(16),
      iv          = crypto.randomBytes(16),
      key         = crypto.pbkdf2Sync(password, salt, iterations, bytes, hash), // derive key
      cipheriv    = crypto.createCipheriv(cipher, key, iv),
      encrypted   = Buffer.concat([ cipheriv.update(decrypted, 'utf8'), cipheriv.final() ]),
      tag         = cipheriv.getAuthTag() // helps identify corruption

    return { encrypted, salt, iv, tag }
  }

  #decrypt(password, { encrypted, salt, iv, tag })
  {
    const
      cipher      = this.config.CERT_PASS_CIPHER,
      hash        = this.config.CERT_PASS_PBKDF2_HASH,
      bytes       = this.config.CERT_PASS_PBKDF2_BYTES,
      iterations  = this.config.CERT_PASS_PBKDF2_ITERATIONS,
      key         = crypto.pbkdf2Sync(password, salt, iterations, bytes, hash),
      decipher    = crypto.createDecipheriv(cipher, key, iv)

    decipher.setAuthTag(tag)
  
    const decrypted = Buffer.concat([ decipher.update(encrypted), decipher.final() ])
    return decrypted.toString('utf8')
  }

  #generateRandomPassword()
  {
    const
      length  = crypto.randomInt(64, 128),
      random  = crypto.randomBytes(length),
      ascii   = random.toString('latin1'),
      nonNull = ascii.replaceAll('\x00', '').replaceAll('$', '')

    return nonNull
  }
}