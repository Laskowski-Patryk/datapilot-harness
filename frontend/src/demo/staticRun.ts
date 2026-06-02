import type { RunResponse, SourceSummary } from "../types";

export const samplePrompts = [
  "Which customers generated the most revenue?",
  "Is there a monthly growth trend?",
  "Compare revenue quality by region.",
  "Which customers have the highest discount but low renewal quality?",
  "Find data quality issues in this dataset.",
];

export const staticSource: SourceSummary = {
  source: "sales",
  row_count: 30,
  column_count: 15,
  schema: [
    { name: "order_id", type: "VARCHAR", nullable: true },
    { name: "order_date", type: "DATE", nullable: true },
    { name: "customer", type: "VARCHAR", nullable: true },
    { name: "account_tier", type: "VARCHAR", nullable: true },
    { name: "industry", type: "VARCHAR", nullable: true },
    { name: "region", type: "VARCHAR", nullable: true },
    { name: "country", type: "VARCHAR", nullable: true },
    { name: "product_line", type: "VARCHAR", nullable: true },
    { name: "plan", type: "VARCHAR", nullable: true },
    { name: "channel", type: "VARCHAR", nullable: true },
    { name: "seats", type: "BIGINT", nullable: true },
    { name: "contract_months", type: "BIGINT", nullable: true },
    { name: "discount_pct", type: "DOUBLE", nullable: true },
    { name: "revenue", type: "BIGINT", nullable: true },
    { name: "renewal_status", type: "VARCHAR", nullable: true },
  ],
  sample_rows: [
    {
      order_id: "ORD-2025-0001",
      order_date: "2025-01-03",
      customer: "Northstar Analytics",
      region: "North America",
      product_line: "DataPilot Cloud",
      revenue: 18450,
      renewal_status: "renewed",
    },
    {
      order_id: "ORD-2025-0002",
      order_date: "2025-01-07",
      customer: "Apex Manufacturing",
      region: "Europe",
      product_line: "DataPilot Cloud",
      revenue: 8640,
      renewal_status: "renewed",
    },
  ],
  profile: {
    source: "sales",
    row_count: 30,
    columns: [
      {
        name: "customer",
        type: "VARCHAR",
        null_count: 0,
        approx_distinct_count: 7,
        sample_values: ["Nimbus Finance", "Northstar Analytics", "Vertex Health"],
      },
      {
        name: "region",
        type: "VARCHAR",
        null_count: 0,
        approx_distinct_count: 3,
        sample_values: ["Europe", "North America", "Asia Pacific"],
      },
      {
        name: "discount_pct",
        type: "DOUBLE",
        null_count: 0,
        approx_distinct_count: 7,
        min: 0,
        max: 0.11,
      },
      {
        name: "revenue",
        type: "BIGINT",
        null_count: 0,
        approx_distinct_count: 31,
        min: 2160,
        max: 25600,
      },
      {
        name: "renewal_status",
        type: "VARCHAR",
        null_count: 0,
        approx_distinct_count: 3,
        sample_values: ["renewed", "at_risk", "churned"],
      },
    ],
  },
};

const query =
  "SELECT customer, region, SUM(revenue) AS total_revenue, COUNT(*) AS orders, " +
  "ROUND(AVG(discount_pct), 3) AS avg_discount_pct, " +
  "SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) " +
  "AS renewal_risk_orders FROM sales GROUP BY customer, region " +
  "ORDER BY total_revenue DESC LIMIT 8";

export const staticRun: RunResponse = {
  run_id: "static-demo",
  completed: true,
  provider: "mock",
  model: "mock-agent",
  question: samplePrompts[0],
  answer:
    "The top revenue customers are Nimbus Finance ($90,840), Northstar Analytics ($84,480), and Vertex Health ($77,170). Nimbus Finance ranks first.",
  plan: [
    "Confirm the available CSV schema.",
    "Profile the fields that matter for the question.",
    "Run a focused DuckDB query over the selected source.",
    "Ground the final answer in the returned rows.",
  ],
  trace: [
    {
      step: 1,
      action: "update_plan",
      reason: "Set a short, auditable plan before touching the data.",
      status: "success",
      duration_ms: 4,
      observation: {
        observation_type: "plan",
        ok: true,
        data: {
          accepted_plan: [
            "Confirm the available CSV schema.",
            "Profile the fields that matter for the question.",
            "Run a focused DuckDB query over the selected source.",
            "Ground the final answer in the returned rows.",
          ],
        },
      },
    },
    {
      step: 2,
      action: "inspect_schema",
      reason: "Inspect sales before generating SQL.",
      status: "success",
      duration_ms: 12,
      row_count: null,
      observation: {
        observation_type: "schema",
        ok: true,
        data: {
          source: "sales",
          columns: staticSource.schema,
          sample_rows: staticSource.sample_rows,
        },
      },
    },
    {
      step: 3,
      action: "profile_data",
      reason: "Profile row counts, distinct values, and ranges before analysis.",
      status: "success",
      duration_ms: 18,
      row_count: 30,
      observation: {
        observation_type: "profile",
        ok: true,
        data: staticSource.profile,
      },
    },
    {
      step: 4,
      action: "query_csv",
      reason: "Retrieve concrete rows that directly answer the question.",
      status: "success",
      duration_ms: 22,
      executed_sql: `SELECT * FROM (${query}) AS q LIMIT 50`,
      row_count: 8,
      observation: {
        observation_type: "query_result",
        ok: true,
        data: {
          executed_sql: `SELECT * FROM (${query}) AS q LIMIT 50`,
          row_count: 8,
          rows: [
            {
              customer: "Nimbus Finance",
              region: "Europe",
              total_revenue: 90840,
              orders: 4,
              avg_discount_pct: 0.078,
              renewal_risk_orders: 0,
            },
            {
              customer: "Northstar Analytics",
              region: "North America",
              total_revenue: 84480,
              orders: 4,
              avg_discount_pct: 0.06,
              renewal_risk_orders: 0,
            },
            {
              customer: "Vertex Health",
              region: "North America",
              total_revenue: 77170,
              orders: 4,
              avg_discount_pct: 0.095,
              renewal_risk_orders: 0,
            },
            {
              customer: "Apex Manufacturing",
              region: "Europe",
              total_revenue: 37100,
              orders: 4,
              avg_discount_pct: 0.075,
              renewal_risk_orders: 0,
            },
          ],
        },
      },
    },
    {
      step: 5,
      action: "finish",
      reason: "The query observation is sufficient to produce a grounded answer.",
      status: "success",
      duration_ms: 3,
      observation: {
        observation_type: "plan",
        ok: true,
        data: { status: "finished" },
      },
    },
  ],
  result_tables: [
    {
      title: "Step 4 result",
      columns: [
        "customer",
        "region",
        "total_revenue",
        "orders",
        "avg_discount_pct",
        "renewal_risk_orders",
      ],
      rows: [
        {
          customer: "Nimbus Finance",
          region: "Europe",
          total_revenue: 90840,
          orders: 4,
          avg_discount_pct: 0.078,
          renewal_risk_orders: 0,
        },
        {
          customer: "Northstar Analytics",
          region: "North America",
          total_revenue: 84480,
          orders: 4,
          avg_discount_pct: 0.06,
          renewal_risk_orders: 0,
        },
        {
          customer: "Vertex Health",
          region: "North America",
          total_revenue: 77170,
          orders: 4,
          avg_discount_pct: 0.095,
          renewal_risk_orders: 0,
        },
        {
          customer: "Apex Manufacturing",
          region: "Europe",
          total_revenue: 37100,
          orders: 4,
          avg_discount_pct: 0.075,
          renewal_risk_orders: 0,
        },
      ],
    },
  ],
  generated_sql: [`SELECT * FROM (${query}) AS q LIMIT 50`],
  latency_ms: 91,
};
