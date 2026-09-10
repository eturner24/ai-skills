export default {
  title: "Project Tracking",
  subtitle: "{{PRODUCT_NAME}} — Release tracking and Jira status",
  sections: [
    {
      id: "active-{{CURRENT_YEAR}}",
      title: "{{CURRENT_YEAR}} Project Tracking",
      type: "active",
      releases: [
        {
          id: "{{RELEASE_1_ID}}",
          title: "{{RELEASE_1_NAME}}",
          meta: [],
          subReleases: [],
          tickets: [],
          nonJiraItems: []
        }
      ]
    }
  ],
  sidebarNav: [
    {
      group: "{{CURRENT_YEAR}} Active",
      items: [
        { label: "{{RELEASE_1_NAME}}", anchor: "{{RELEASE_1_ID}}" }
      ]
    }
  ]
}
