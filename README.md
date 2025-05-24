# Deadman's Gazette

A dead man's switch, implemented using cancellable time-lock encryption. 

Designed for security to withstand coordinated attack from state-level actors.

## Overview

#### Time-Lock Encryption

Time-lock encryption is provided by the [drand consensus network](https://docs.drand.love/docs/timelock-encryption/), a distributed randomness beacon maintained by [The League of Entropy](https://www.drand.love/loe). 

As of the time of this writing (Spring 2025), that node network is currently considered trustable and non-malicious.

#### Cancellability

Cancellability is achieved by establishing a breakable chain of decryptions, such that access to the final payload is granted only by access to an intermediary, whose access in turn is ultimately provisioned by the drand time-lock. We can effectively cancel a dead man's switch established in this way by scrubbing the decryption data from the intermediary before its credentials are decryptable by the time-lock release. If no action is taken by the originator, however, the time-lock will grant access to the intermediary, which then grants access to the final payload.

To provide an analogy, imagine you've locked an important document in a bank lockbox, and mailed your friend the key. Your friend will be able to open the box and view the document as soon as they receive the key. You can only stop this process by removing the document before the key arrives.

Now assume that, for whatever reason, you can never remove the document from the lockbox (or, as the case may be, that exact copies of the locked document have been made). How can you prevent your friend from retrieving the document once they have the key?

This is where the breakable chain comes into play. Instead of mailing your friend the key, you lock the key in a combination safe (that you DO maintain access to), and you mail your friend the combination. Nothing can stop them from opening that safe, but if you so choose, you can open it yourself beforehand and simply remove they key. Access to the safe no longer matters, because it no longer provides access to the document.

#### Deadman's Gazette

The system proposed here is an implementation of the safe from that analogy, along with automatable instructions on how to set up, cancel, and defer a dead man's switch using the server.

## Whitepaper

### Deadman's Gazette Server

The server itself is a very basic set of authenticated API around a secured data store:

#### API

- `INSERT (passwordHash,encryptedPayloadKey)`
    - `passwordHash` is the unique primary key and identifier, as well as the authentication
- `DELETE (passwordHash)`
    - securely deletes `encryptedPayloadKey` record
- `GET (passwordHash) ->encryptedPayloadKey`
- Public HTTPS: 
    - Serves a static page webapp to perform the client create/invalidate/delay actions described below 
    - Could also provide distribution of the public payload/packet data, directly to a blockchain or drop site

#### Data Store
- [SQLCipher](https://github.com/sqlcipher/sqlcipher)
    - Provides encrypted data storage and secure deletion
    - Embedded in the server itself

#### Deployment
- Containerized API+DB
- Deployed as a Tor Hidden Service
    - [Hardened against DoS attacks](https://community.torproject.org/onion-services/advanced/dos/)
    - [Following Best Practices](https://riseup.net/en/security/network-security/tor/onionservices-best-practices)

### Creating a Dead Man's Switch

0. Choose a payload with which you want to create a dead man's switch. 
    - 🚨 **At the end of the chosen time-lock expiration, and without action from you, this payload will be made public** 🚨
1. Generate a strong encryption/decryption key pair for the payload 
    - Symmetric or asymmetric public/private keys
2. Generate a random plaintext password
    - THIS IS THE TOKEN THAT PROVIDES AUTHORIZATION FOR ALL FUTURE ACTIONS 
    - KEEP IT SECRET, KEEP IT SAFE
3. Use the password from Step 2 to encrypt the payload decryption key from Step 1 
4. Deploy a Deadman's Gazette server (or use a trusted hosted service)
    - It's important that this server remain active for the duration of the expiration time length. It is therefore recommended that it be deployed secretly, resiliently, and securely, or that a trustworth hosted service (i.e. one maintained by a reputable journalism outlet) is used.
5. Upload the hash of the plaintext password from Step 2 and the encryptedPayloadKey from Step 3 to the Gazette server from Step 4
6. Use the encryption key from Step 1 to encrypt the payload from Step 0
    - This can never been decrypted without the decryption key from Step 1, which itself can only be decrypted using the password from Step 2
    - At this point, NOBODY but you has access to the password, which means that until steps 7 and 8 are completed below, the payload cannot be decrypted
7. Time-lock encrypt the packet {password(Step 1), serverOnionRoute(Step 3)} using drand
    - Map the desired expiration time-length to a drand round number and use that round's encryption key
8. Publish the encrypted payload from Step 6 and the time-locked packet from Step 7, as well as a Round Number for the decryption key from drand
    - Must be somewhere public and resilient (mirrored) so that it cannot be taken down, i.e. a publicly maintained drop site, or even a blockchain (if the payload is small enough)
    - It's important that the location is public, visible, and knowable to people who would be interested in performing the decryption after the time-lock
        - It's also important that the packet, payload and round number are all associated with each other visibly, to facilitate recovery if/when desired
9. Discard ALL data generated in these steps, other than the password (and obviously the published payload/packet data)

### What happens next?

The drand network ensures that the packet cannot be decrypted before the expiration time. At that time, without action from the originator of the dead man's switch (using the password generated above), the dead man's switch will activate:

1. The decryption key for the packet will be generated and distributed by drand
2. Using that decryption key, a watcher of your dead man's switch can decrypt the publicly-available packet and retrieve the password as well as the onion route to the Deadman's Gazette hosting your data
3. That person can then retrieve the encrypted payload key from the server, and decrypt it using the password
4. Finally, they can use the resulting decryption key to decrypt the original, publicly-available payload
5. And that's it! The switch has achieved the desired result

### How to Deactivate/Reset the Switch

This system uses a breakable chain of decryptions to provide cancellation, which is otherwise not an inherent feature of drand time-locking. In order to prevent decryption at the end of the time-lock, the password must be rendered useless by securely deleting the encryptedPayloadKey record from the server by passwordHash (**NOTE: this requires trust, see below***)

Once the record is deleted, the time-locked password is useless, and the encryptedPayloadKey no longer exists to be decrypted. The dead man's switch has been effectively disabled.

To delay/reset the switch, simply repeat part of the process above before deletion:
1. GET the encryptedPayloadKey by passwordHash from the server
    - Deletion can happen any time after Step 1
2. Decrypt encryptedPayloadKey using the password
3. Generate a new random password and re-encrypt the payload key
4. Upload the new passwordHash / encryptedPayloadKey to the server
5. Time-lock encrypt the packet using drand with the new expiry
6. Publish the new packet and round number and publicly associate them with the original payload.

### Security Model

#### Drand Security Limitations

From the [drand documentation](https://docs.drand.love/docs/timelock-encryption/#%EF%B8%8F-security-assumptions):

> - **Malicious Nodes:** If a threshold number of malicious nodes join the network, they could generate all future random values and decrypt future timelock ciphertexts. Our quicknet network started with 18 organizations running 22 nodes, minimizing this risk.
> - **Quantum Resistance:** Our cryptography does not use quantum-resistant algorithms. If you encrypt something for 1000 years and a viable quantum computer emerges, it could decrypt it. Currently, no widespread quantum-resistant schemes exist for threshold identity-based encryption (IBE) cryptography.
> - **Network Shutdown:** If the League of Entropy shuts down, members would delete their keys. This means ciphertexts created after the network's cessation would be un-decryptable until quantum computers can break them.

#### Chain of Decryptions

```
[drandTimelock]->[password]->[passwordHash]->[encryptedPayloadKey]->[payloadKey]->[PAYLOAD]
                 [password]---------------------------------------^
```

The payload maintains it's original encryption at all times. The indirection of using a secondary encryption to secure that decryption key allows the time-lock to reset or cancel at the will of the originator, simply by breaking the chain of decryptions (at the password) that ends with the original payload decryption key.

#### *Where is Trust Necessary

The Deadman's Gazette server is the ONLY link of trust in this chain -- and it's important to understand what is being trusted, how it fits into this system, and how you can minimize or eliminate this trust entirely. 

The Gazette server uses SQLCipher as a database - this prevents any unauthorized person from reading data even if the DB files leaked, but it ALSO provides secure deletion to prevent even authorized persons from reading data once it has been deleted (see the [docs](https://discuss.zetetic.net/t/forensic-recovery-of-deleted-data/20)). 

This is important, because if a cancelled password/payloadKey are persisted without your knowledge, the payload CAN STILL be decrypted once the drand network publishes the decryption key for that password after expiry. The Deadman's Gazette server accepts a *hash* of the password as identity/auth, NOT the original password itself, meaning that the server is no more capable of decrypting the payload key than anyone else, until the time-lock decryption key is published by drand. Securely deleting the stored data BEFORE this happens ensures the chain of decryptions is broken irrevokably, and the payload cannot be decrypted, *even by the server that stored the data*. 

This server is provided open-source, in order to eliminate this trust boundary. You can be assured that the server deletes (and does not mirror/persist) the data as claimed simply by auditing the code to your satisfaction (or, of course, by trusting the security experts who do such things).

HOWEVER, USE OF THIS AS A HOSTED SERVICE COMES WITH AN IMPLICIT TRUST THAT THE DEPLOYED SERVER IS RUNNING THE AUDITED CODE, AND THUS THAT DATA IS BEING DELETED (AND NOT BEING MIRRORED/PERSISTED OTHERWISE) IN THE WAY IT CLAIMS TO BE. This cannot be guaranteed using any hosted service, though presumably many/most would be trustworthy. **For this reason, if you have any concerns about the trustworthiness of a hosted service, or are handling payloads too sensitive to tolerate any level of risk, it is best to deploy your own, using verified open-source software.**

The drand network is resilient against a certain number of malicious nodes (see the [docs](https://docs.drand.love/docs/security-model/)), which should keep the time-lock duration intact and prevent early decryption by curious, unauthorized parties. 

Publication of the payload and the packet should be done in such a way as to be resilient against coordinated effort to remove the data, ensuring it exists to be decrypted if/when desired. For small data payloads, distributed ledgers (blockchains) may be an effective mechanism for this.

Using onion services for the server provides effective security and anonymization, as well as a natural obfuscation of the server itself, thus precluding most likely attacks. A denial of service attack (e.g. using TorsHammer) could temporarily disable the server and thus prevent any action, but since the most likely goal of an adversary would be to prevent release of the payload, this attack would actually work against that interest. By denying the originator access to cancellation, a DoS attack (unless it is maintained and unmitigated indefinitely) serves only to prevent cancellation of the payload's release. Once the server becomes available again, the decryption chain will remain intact. 
