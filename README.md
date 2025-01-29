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

tests 14
suites 5
pass 14

-------------------------------------------------------------------------------------------------------------
file                    | line % | branch % | funcs % | uncovered line
-------------------------------------------------------------------------------------------------------------
config.js               | 100.00 |   100.00 |  100.00 | 
index.js                |  73.36 |    74.42 |   74.07 | 44-47 120-124 144-146 150-154 157-161 183-185 254-2…
index.test.js           | 100.00 |   100.00 |  100.00 | 
manager                 |        |          |         | 
 spokes.js              | 100.00 |   100.00 |  100.00 | 
 spokes.test.js         | 100.00 |   100.00 |  100.00 | 
 subscribers.js         |  78.21 |   100.00 |   83.33 | 61-77
 subscribers.test.js    | 100.00 |   100.00 |  100.00 | 
-------------------------------------------------------------------------------------------------------------
all files               |  82.97 |    86.32 |   87.50 |
-------------------------------------------------------------------------------------------------------------
```

## License

This project is licensed under the MIT License.

## Contributing

Feel free to submit issues or pull requests for improvements or additional features.
