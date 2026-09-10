export default {
  title: "Release Summary: All Time",
  subtitle: "{{PRODUCT_NAME}} — All releases",

  stats: [
    { label: "Total Releases", value: "0" },
    { label: "Total Story Points", value: "0" },
    { label: "Avg SPs / Release", value: "0" },
    { label: "Tracking Since", value: "{{CURRENT_YEAR}}" },
  ],

  velocity: {
    title: "Story Points by Release (All Time)",
    bars: [],
  },

  years: [],

  sidebarNav: [
    {
      group: "On This Page",
      items: [
        { label: "Overview", anchor: "stats" },
        { label: "Velocity", anchor: "velocity" },
        { label: "Year-over-Year", anchor: "yearly" },
      ],
    },
  ],
}
