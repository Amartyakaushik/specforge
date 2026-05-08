export interface EvalPrompt {
  id: string;
  category: "realistic" | "edge-case";
  prompt: string;
  expectedFeatures: string[];
  difficulty: "easy" | "medium" | "hard";
  edgeCaseType?: "vague" | "conflicting" | "incomplete" | "overspecified" | "adversarial";
}

export const REALISTIC_PROMPTS: EvalPrompt[] = [
  {
    id: "r1",
    category: "realistic",
    prompt: "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.",
    expectedFeatures: ["auth", "contacts_crud", "dashboard", "roles", "payments", "analytics"],
    difficulty: "hard",
  },
  {
    id: "r2",
    category: "realistic",
    prompt: "Create a project management tool with teams, tasks, kanban boards, and time tracking. Managers can assign tasks to team members.",
    expectedFeatures: ["auth", "teams_crud", "tasks_crud", "kanban", "time_tracking", "roles"],
    difficulty: "hard",
  },
  {
    id: "r3",
    category: "realistic",
    prompt: "Build an e-commerce store with products, categories, cart, checkout, and order tracking. Admin manages inventory.",
    expectedFeatures: ["products_crud", "categories", "cart", "orders", "auth", "inventory"],
    difficulty: "hard",
  },
  {
    id: "r4",
    category: "realistic",
    prompt: "Create a blog platform with posts, comments, categories, and user profiles. Authors can publish drafts. Admins moderate.",
    expectedFeatures: ["posts_crud", "comments", "categories", "profiles", "auth", "roles"],
    difficulty: "medium",
  },
  {
    id: "r5",
    category: "realistic",
    prompt: "Build a restaurant reservation system with tables, bookings, menu items, and customer reviews.",
    expectedFeatures: ["tables_crud", "bookings_crud", "menu_crud", "reviews"],
    difficulty: "medium",
  },
  {
    id: "r6",
    category: "realistic",
    prompt: "Create a learning management system with courses, lessons, quizzes, student enrollment, and grade tracking.",
    expectedFeatures: ["courses_crud", "lessons_crud", "quizzes", "enrollment", "grades", "auth"],
    difficulty: "hard",
  },
  {
    id: "r7",
    category: "realistic",
    prompt: "Build an inventory management system with products, warehouses, stock levels, suppliers, and purchase orders.",
    expectedFeatures: ["products_crud", "warehouses", "stock", "suppliers", "purchase_orders"],
    difficulty: "medium",
  },
  {
    id: "r8",
    category: "realistic",
    prompt: "Create a helpdesk ticketing system with tickets, agents, customers, SLA tracking, and knowledge base.",
    expectedFeatures: ["tickets_crud", "agents", "customers", "sla", "knowledge_base", "auth"],
    difficulty: "hard",
  },
  {
    id: "r9",
    category: "realistic",
    prompt: "Build a fitness tracking app with workouts, exercises, progress logs, goals, and personal records.",
    expectedFeatures: ["workouts_crud", "exercises", "progress", "goals", "auth"],
    difficulty: "medium",
  },
  {
    id: "r10",
    category: "realistic",
    prompt: "Create an event management platform with events, tickets, attendees, venues, and check-in system.",
    expectedFeatures: ["events_crud", "tickets", "attendees", "venues", "checkin", "auth"],
    difficulty: "medium",
  },
];

export const EDGE_CASE_PROMPTS: EvalPrompt[] = [
  {
    id: "e1",
    category: "edge-case",
    prompt: "Build me an app",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "vague",
  },
  {
    id: "e2",
    category: "edge-case",
    prompt: "Create a system where users can do everything but also nothing is allowed without permission and there's no login",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "conflicting",
  },
  {
    id: "e3",
    category: "edge-case",
    prompt: "I need a thing for managing stuff with some pages",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "vague",
  },
  {
    id: "e4",
    category: "edge-case",
    prompt: "Build a social media platform with real-time messaging, video streaming, AI content moderation, blockchain-based payments, and AR filters",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "overspecified",
  },
  {
    id: "e5",
    category: "edge-case",
    prompt: "Create a todo app. But it should also be an ERP. And a CRM. And have machine learning recommendations.",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "conflicting",
  },
  {
    id: "e6",
    category: "edge-case",
    prompt: "Build an app with users who are both admins and regular users at the same time, where admins can't see admin pages",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "conflicting",
  },
  {
    id: "e7",
    category: "edge-case",
    prompt: "Task tracker",
    expectedFeatures: ["tasks_crud"],
    difficulty: "easy",
    edgeCaseType: "incomplete",
  },
  {
    id: "e8",
    category: "edge-case",
    prompt: "Build a system with 50 different entity types, each with 30 fields, connected in a complex graph of relationships",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "overspecified",
  },
  {
    id: "e9",
    category: "edge-case",
    prompt: "",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "adversarial",
  },
  {
    id: "e10",
    category: "edge-case",
    prompt: "Build a hotel booking system but don't include any database and the API should have no endpoints",
    expectedFeatures: [],
    difficulty: "hard",
    edgeCaseType: "conflicting",
  },
];

export const ALL_PROMPTS = [...REALISTIC_PROMPTS, ...EDGE_CASE_PROMPTS];
