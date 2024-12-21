# Eventflow Hub

Eventflow Hub is a central component of the Eventflow system that manages mTLS-secured connections between spokes and peer hubs, facilitating message publishing, subscription handling, and event scheduling.

> [!NOTE]
> This module is still under development and in activing testing.

## Features

- **TLS-Secured Communication:** Ensures secure connections using certificates for both server and client communication.
- **Event Management:** Publishes and broadcasts events to subscribed spokes and peer hubs.
- **Subscriber Management:** Tracks spokes subscribing to specific events.
- **Scheduled Events:** Executes scheduled tasks with error handling and persistence.
- **Scalable Architecture:** Supports multi-hub communication for distributed systems.

## Testing

Run the test suite using:

```bash
npm run test-build
npm test
```

### Test Coverage

```
▶ @superhero/eventflow-hub
  ▶ Lifecycle
    ✔ Can initialize EventflowHub correctly (239.24859ms)
  ✔ Lifecycle (240.434564ms)

  ▶ Connections and Communication
    ▶ Handles spoke connections
      ✔ Broadcasts peer hub online event (6422.456966ms)
    ✔ Handles spoke connections (12880.167996ms)
  ✔ Connections and Communication (12880.634724ms)
✔ @superhero/eventflow-hub/hub (13122.085188ms)

▶ @superhero/eventflow-hub/manager/certificates
  ✔ Throw error if CERT_PASS_ENCRYPTION_KEY is missing in config (1.931823ms)
  ▶ Get root certificate
    ✔ Get same root certificate each time lazyloading it (0.421813ms)

    ▶ Get intermediate certificate
      ▶ Get leaf certificate
        ✔ Clear cache and still get the same certificates (6284.100912ms)
        ✔ Revoke certificate and regenerate when expired (10.43074ms)
      ✔ Get leaf certificate (9226.667566ms)
    ✔ Get intermediate certificate (11230.17401ms)
  ✔ Get root certificate (13150.284397ms)
✔ @superhero/eventflow-hub/manager/certificates (13155.312263ms)

▶ @superhero/eventflow-hub/manager/spokes
  ✔ Add and retrieve all sockets (3.451128ms)
  ✔ Delete a socket (0.227951ms)
  ✔ Destroy all sockets (0.352411ms)
  ✔ Handle deleting non-existent socket gracefully (0.275818ms)
  ✔ Return empty array if no sockets exist (0.165647ms)
✔ @superhero/eventflow-hub/manager/spokes (6.103143ms)

▶ @superhero/eventflow-hub/manager/subscribers
  ✔ Add and retrieve subscribers (2.384233ms)
  ✔ Handle wildcard subscribers (0.308446ms)
  ✔ Return empty array if no subscribers exist (0.152296ms)
  ✔ Delete a subscriber and clean up empty structures (0.243432ms)
  ✔ Clean up domain and event mappings after deletion (0.226052ms)
  ✔ Not throw errors when deleting non-existent subscribers (0.362547ms)
✔ @superhero/eventflow-hub/manager/subscribers (5.36466ms)

tests 22
suites 6
pass 21

-------------------------------------------------------------------------------------------------------------------------
file                    | line % | branch % | funcs % | uncovered lines
-------------------------------------------------------------------------------------------------------------------------
config.js               | 100.00 |   100.00 |  100.00 | 
index.js                |  70.42 |    65.85 |   74.07 | 39-42 109-113 133-135 139-143 146-150 172-174 234-235 242-245 2…
index.test.js           | 100.00 |   100.00 |  100.00 | 
manager                 |        |          |         | 
 certificates.js        |  85.71 |    87.50 |   88.24 | 137-140 150-154 194-200 204-213 216-231
 certificates.test.js   | 100.00 |   100.00 |  100.00 | 
 spokes.js              | 100.00 |   100.00 |  100.00 | 
 spokes.test.js         | 100.00 |   100.00 |  100.00 | 
 subscribers.js         |  78.21 |   100.00 |   83.33 | 61-77
 subscribers.test.js    | 100.00 |   100.00 |  100.00 | 
-------------------------------------------------------------------------------------------------------------------------
all files               |  85.07 |    87.22 |   89.36 | 
-------------------------------------------------------------------------------------------------------------------------
```

## License

This project is licensed under the MIT License.

## Contributing

Feel free to submit issues or pull requests for improvements or additional features.
