---
name: expressions-and-predicates
title: Expressions and Predicates
description: The Simple language and other expression languages used in filters, choices, transforms, and dynamic endpoints.
labels: core,languages
source: https://camel.apache.org/components/4.23.x/languages/index.html
---

Expressions produce a value. Predicates produce a boolean. Camel EIPs use them everywhere: `filter`, `when`, `setBody`, `recipientList`, `split`, `aggregate` correlation, and `toD`.

The Simple language is the default and most portable choice:

```java
from("direct:orders")
    .choice()
        .when(simple("${header.country} == 'US'"))
            .to("direct:us")
        .when(simple("${body.total} > 1000"))
            .to("direct:highValue")
        .otherwise()
            .to("direct:standard")
    .end();
```

Common Simple expressions:

- `${body}` — the message body.
- `${bodyAs(java.lang.String)}` — body converted to a type.
- `${header.name}` — a message header.
- `${exchangeProperty.name}` — an exchange property.
- `${variable.name}` — a route-scoped variable (Camel 4).
- `${exchangeId}`, `${routeId}`, `${messageHistory}` — diagnostic values.
- `${date:now:yyyy-MM-dd}` — formatted dates.
- `${random(1,100)}`, `${uuid}` — generated values.

Operators include `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `startsWith`, `endsWith`, `regex`, `in`, `not in`, `is null`, and `and` / `or` / `not`.

Other languages:

- `constant(...)` for fixed values.
- `header("name")`, `exchangeProperty("name")`, `variable("name")`.
- `jsonpath("$.customer.id")` for JSON.
- `xpath("/order/id")` for XML.
- `jq(".customer.id")` for JSON with jq semantics.
- `method("bean", "methodName")` or `bean(...)` for Java logic.
- `groovy(...)`, `mvel(...)`, `js(...)`, `ognl(...)` where the dependency is present.
- `ref("myExpression")` for expressions registered in the registry.

Discover them with `search_camel(query, kind="language")`, then `get_doc(name, kind="language")` and `get_options(name, kind="component")`.

Predicate performance:

- Simple is fast and avoids scripting overhead.
- Bean method predicates keep complex logic compiled and testable.
- JSONPath and XPath parse on each evaluation unless you cache compiled expressions; prefer header enrichment when the same value is used repeatedly.
- Keep predicates side-effect free so error handling and redelivery remain safe.
