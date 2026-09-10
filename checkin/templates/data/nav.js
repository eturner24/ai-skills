export default {
  pages: [
    {
      id: "project-tracking",
      route: "#/project-tracking",
      dataFile: "data/project-tracking.js",
      css: ["css/project-tracking.css"],
      template: "project-tracking",
      title: "Project Tracking"
    },
    {
      id: "todo-list",
      route: "#/todo-list",
      dataFile: "data/todo-list.js",
      css: ["css/todo-list.css"],
      template: "todo-list",
      title: "To-Do List"
    },
    {
      id: "quarterly-connection",
      route: "#/quarterly-connection",
      dataFile: "data/quarterly-connection.js",
      css: ["css/quarterly-connection.css"],
      template: "quarterly-connection",
      title: "Quarterly Connection"
    },
    {
      id: "release-summary-current",
      route: "#/release-summary/current",
      dataFile: "data/release-summary-current.js",
      css: ["css/release-summary.css"],
      template: "release-summary",
      title: "{{CURRENT_YEAR}}"
    },
    {
      id: "release-summary-all",
      route: "#/release-summary/all",
      dataFile: "data/release-summary-all.js",
      css: ["css/release-summary.css"],
      template: "release-summary-all",
      title: "All Time"
    }
  ],
  sidebarGroups: [
    {
      group: "Pages",
      items: [
        { id: "project-tracking", label: "Project Tracking" },
        { id: "todo-list", label: "To-Do List" },
        { id: "quarterly-connection", label: "Quarterly Connection" }
      ]
    },
    {
      group: "Release Summary",
      items: [
        { id: "release-summary-current", label: "{{CURRENT_YEAR}}" },
        { id: "release-summary-all", label: "All Time" }
      ]
    }
  ],
  defaultRoute: "#/project-tracking"
}
