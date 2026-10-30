---
name: uri-syntax-and-options
title: URI Syntax and Options
description: How Camel endpoint URIs are structured, how path parameters differ from options, and how to configure and discover options.
labels: core,configuration
source: https://camel.apache.org/manual/uris.html
---

A Camel endpoint URI has this general shape:

```
scheme:context-path?option1=value1&option2=value2
```

Examples:

```
direct:orders
seda:events?concurrentConsumers=5
file:data/inbox?noop=true&delay=5000
kafka:orders?brokers=localhost:9092&groupId=billing
aws2-sqs:orders?region=us-east-1&autoCreateQueue=true
```

Rules and details:

- The scheme selects the component (`file`, `kafka`, `aws2-sqs`, ...). Camel resolves it through the `CamelContext`.
- The context path is component-specific. Some components require it (`kafka:topic`, `aws2-sqs:queueName`), others do not (`timer:tick` uses a name, `direct:name` uses a name).
- Path parameters are positional or named depending on the component. The catalog `syntax` field shows the expected form, for example `aws2-sqs:queueNameOrArn`.
- Options after `?` are endpoint or component options. Separate them with `&`; in XML, escape the ampersand as `&amp;`.
- Option values can be raw text, booleans, numbers, enums, or references to beans and property placeholders.
- Component-level options are shared by all endpoints of that component. Endpoint options override them for one URI.
- Some components expose options that are producer-only or consumer-only. The catalog marks them with groups such as `producer`, `consumer`, `common`, `security`, and `advanced`.

Property placeholders:

```
kafka:orders?brokers={{kafka.brokers}}
file:{{input.dir}}?delay={{poll.delay:5000}}
```

`{{key}}` is resolved by the properties component. `{{key:default}}` supplies a default. In IG and Spring Boot applications, placeholders usually come from application properties, environment variables, or the Settings Vault.

Discover options with this MCP:

- `get_component(name, includeOptions=true)` returns the full option table.
- `get_options(name, scope="endpoint", group="producer")` filters options.
- `get_options(name, requiredOnly=true)` shows only required options.

Prefer the endpoint DSL when available (`kafka("orders").brokers("...")`) because it is type-safe and IDE-friendly. String URIs remain necessary for YAML, XML, and dynamic endpoints.
