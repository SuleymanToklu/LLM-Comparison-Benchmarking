# prompt 3

Build only the frontend UI for a Developer Profile Analyzer app.

Tech: Next.js 14, TypeScript, Tailwind CSS, Recharts.

The UI has 3 states:

1. LANDING STATE
- Full-screen hero
- Centered GitHub username input with search icon
- Submit button
- Minimal, clean design
1. LOADING STATE
- Skeleton loaders for each dashboard section
- Animated status messages cycling through:
"Fetching repositories..."
"Analyzing code patterns..."
"Generating insights..."
1. DASHBOARD STATE
Sections:

A. Profile Header

- Avatar (img), name, bio, location
- Stats row: repos, followers, following
- Overall score badge (0-100)

B. Skill Radar (Recharts RadarChart)

- Axes: Backend, Frontend, DevOps, Testing, Consistency, Project Depth
- Values: 0-100

C. Language Distribution (Recharts BarChart)

- Top 5 languages
- Horizontal bars with percentages

D. AI Insights (3 columns)

- Strengths: green cards with checkmark icon
- Weaknesses: red/orange cards with warning icon
- Recommendations: blue cards with arrow icon

E. Career Fit

- List of { role: string, confidence: number }
- Progress bar for each role

F. Engineering Maturity

- Grid checklist
- Items: Tests, Docker, CI/CD, README, Deployment
- Green check or red X for each

Use this mock data for development:
const mockData = {
profile: { username: "johndoe", name: "John Doe", bio: "Full-stack developer", avatar: "https://github.com/github.png", followers: 120, following: 45, publicRepos: 34 },
scores: { backend: 78, frontend: 34, devops: 20, testing: 15, consistency: 61, projectDepth: 73, overallScore: 47 },
topLanguages: [{ name: "Python", percentage: 52 }, { name: "TypeScript", percentage: 30 }, { name: "JavaScript", percentage: 12 }, { name: "Go", percentage: 4 }, { name: "Shell", percentage: 2 }],
insights: {
summary: "Backend-oriented developer with strong Python expertise and consistent activity.",
strengths: ["Strong Python ecosystem usage across 14 repos", "Consistent commit activity over last 6 months"],
weaknesses: ["No frontend projects detected", "Zero automated testing evidence"],
recommendations: ["Deploy a public FastAPI service to demonstrate backend skills", "Add pytest to at least 3 existing repos"],
careerFit: [{ role: "Backend Engineer", confidence: 82 }, { role: "ML Engineer", confidence: 67 }, { role: "Frontend Engineer", confidence: 24 }]
},
engineering: { hasTests: false, hasDockerfile: true, hasCICD: false, hasReadme: true, hasDeployment: false }
}

Build complete, responsive UI. No placeholder sections. All sections must render with mock data.