---
name: integration-gateway-mapping
title: Camel in Guidewire Integration Gateway
description: How the generic Camel concepts map to Guidewire Integration Gateway routes, endpoints, configuration, and testing.
labels: guidewire,ig
source: Guidewire Integration Gateway documentation
---

Guidewire Integration Gateway (IG) runs Apache Camel routes inside a Guidewire-managed application. The Camel fundamentals in this knowledge base apply directly; IG adds conventions and managed endpoints around them.

Mapping:

- Route builder: IG routes extend `GwRouteBuilder` or a standard Camel `RouteBuilder`.
- In-app hand-off: `direct:` endpoints connect routes inside the same Camel context.
- Guidewire integration points: `gw-integration:` endpoints are managed by IG and connect to Guidewire platform services.
- Configuration: `gw-integration.yaml`, `route.properties`, and `gradle.properties` supply URIs, credentials, and feature flags.
- Secrets: prefer Settings Vault or Helios-backed property placeholders over literals in route code.
- Event sources: App Events and webhooks are typically delivered through queues or REST endpoints, then consumed by a Camel route.
- Idempotency: use `idempotentConsumer` with a persistent repository when the same event can be delivered more than once.
- Error handling: configure `onException` and a dead letter destination per integration, and make retries safe for the downstream system.
- Testing: unit-test routes with `camel-test-junit5`, mock `gw-integration:` and external endpoints, and assert message shape and destination.

Typical flow:

```
Guidewire event or webhook
  -> queue or REST endpoint
  -> Camel consumer (gw-integration or direct)
  -> unmarshal / validate / transform
  -> producer (REST, SQS, S3, JMS, database)
  -> acknowledgement or dead letter on failure
```

Practical rules:

- Keep transformation logic in beans or dedicated processors; keep route builders declarative.
- Read every URI and secret from configuration, not code.
- Set route IDs and log correlation IDs so integration failures are traceable.
- Verify component and option names against the pinned Camel catalog before writing routes.
- Check the IG framework documentation for lifecycle, packaging, and deployment constraints that differ from standalone Camel.

This note is intentionally generic. For exact IG APIs, endpoint schemes, and configuration keys, consult the Guidewire Integration Gateway documentation and your project's existing route builders.
