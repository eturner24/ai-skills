export default {
  title: "To-Do List",
  subtitle: "All open action items, organized by release.",
  groups: [
    {
      id: "{{RELEASE_1_ID}}",
      title: "{{RELEASE_1_NAME}}",
      items: []
    },
    {
      id: "general",
      title: "General",
      items: []
    },
    {
      id: "completed",
      title: "Completed",
      collapsible: true,
      items: []
    }
  ],
  sidebarNav: [
    { group: "Sections", items: [
      { label: "{{RELEASE_1_NAME}}", anchor: "{{RELEASE_1_ID}}" },
      { label: "General", anchor: "general" },
      { label: "Completed", anchor: "completed" }
    ]}
  ]
}
