export default {
  title: "Release Summary: {{CURRENT_YEAR}}",
  subtitle: "{{PRODUCT_NAME}} — Metrics, release breakdowns, and accomplishments",

  stats: [
    { label: "Releases", value: "0" },
    { label: "Total SP", value: "0" },
    { label: "Avg SP / Release", value: "0" },
    { label: "Active Release", value: "{{RELEASE_1_NAME}}" },
  ],

  velocity: {
    title: "Story Points by Release ({{CURRENT_YEAR}})",
    bars: [],
  },

  releases: [],

  sidebarNav: [
    {
      group: "On This Page",
      items: [
        { label: "Overview", anchor: "stats" },
        { label: "Velocity", anchor: "velocity" },
        { label: "Release Breakdown", anchor: "releases" },
      ],
    },
  ],
}
