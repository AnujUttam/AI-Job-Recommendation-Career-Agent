export const INITIAL_CANDIDATE_PROFILE = {
  fullName: 'Aarav Mehta',
  email: 'aarav.mehta@example.com',
  headline: 'Full-Stack & Applied AI Engineer',
  currentLocation: 'Bengaluru, India',
  experienceLevel: 'Entry Level (0-2 yrs)',
  yearsOfExperience: 1.5,
  bio: 'Software engineer focused on Python, Node.js, React, and LLM-backed web applications. Passionate about semantic search, retrieval pipelines, and clean backend architecture.',
  githubUrl: 'https://github.com/aarav-mehta-dev',
  linkedinUrl: 'https://linkedin.com/in/aarav-mehta-dev',
  skills: [
    'Python',
    'JavaScript',
    'React',
    'Node.js',
    'Express',
    'FastAPI',
    'MongoDB',
    'Tailwind CSS',
    'Docker',
    'LangGraph',
    'Qdrant',
    'REST APIs',
  ],
  preferredLocations: ['Bengaluru', 'Remote', 'Hyderabad'],
  remotePreference: 'Hybrid or Remote',
  desiredRoles: [
    'AI Software Engineer',
    'Full-Stack Engineer',
    'Backend Engineer (Python / Node.js)',
  ],
};

export const INITIAL_RESUME_ANALYSIS = {
  fileName: 'Aarav_Mehta_Resume_2026.pdf',
  uploadedAt: '2026-11-24T10:30:00Z',
  fileSizeKb: 284,
  atsScore: 86,
  completionPercentage: 90,
  sectionsCompleted: [
    { key: 'summary', label: 'Professional Summary', completed: true },
    { key: 'skills', label: 'Technical Skills', completed: true },
    { key: 'experience', label: 'Work Experience', completed: true },
    { key: 'projects', label: 'Key Projects', completed: true },
    { key: 'education', label: 'Education', completed: true },
    { key: 'certifications', label: 'Certifications (Optional)', completed: false },
  ],
  summary:
    'Strong early-career engineering profile combining full-stack TypeScript/JavaScript delivery with hands-on applied AI tooling (FastAPI, LangGraph, vector databases). Adding quantified latency/throughput metrics to project bullets and a dedicated cloud deployment certification will lift ATS alignment above 92%.',
  strengths: [
    'Clear alignment between backend engineering (Node.js, FastAPI) and vector search workflows.',
    'Strong project portfolio demonstrating end-to-end system ownership.',
    'Well-structured technical skills grouped by language, framework, and infrastructure.',
  ],
  improvements: [
    'Quantify impact in recent internship bullets (e.g., API latency reduction %, test coverage).',
    'Add Kubernetes or AWS/GCP hands-on exposure if targeting production ML infrastructure roles.',
    'Highlight experience with LLM evaluation frameworks (e.g., RAGAS, golden test suites).',
  ],
  extractedSkills: {
    Languages: ['Python', 'JavaScript', 'SQL', 'HTML/CSS'],
    Frameworks: ['React', 'Node.js', 'Express', 'FastAPI', 'Tailwind CSS', 'LangGraph'],
    DataAndAI: ['Qdrant', 'Sentence Transformers', 'Google Gemini API', 'MongoDB', 'Pandas'],
    Tools: ['Docker', 'Git', 'GitHub Actions', 'Postman', 'Vite'],
  },
  education: [
    {
      id: 'edu-1',
      degree: 'B.Tech in Computer Science & Engineering',
      institution: 'National Institute of Technology, Surathkal',
      duration: '2021 - 2025',
      grade: '8.74 / 10.0 CGPA',
      highlights: 'Coursework: Data Structures, Machine Learning, Distributed Systems, DBMS',
    },
  ],
  experience: [
    {
      id: 'exp-1',
      role: 'Software Engineering Intern (Backend & AI)',
      company: 'NovaStack Labs',
      location: 'Bengaluru (Hybrid)',
      duration: 'Jan 2025 - Jul 2025',
      highlights: [
        'Built REST endpoints in FastAPI and Express for internal document indexing across 12,000+ technical PDFs.',
        'Integrated dense vector retrieval using Qdrant, cutting relevant snippet lookup time to under 180ms.',
        'Implemented JWT authentication middleware and standardized JSON error responses across 14 endpoints.',
      ],
    },
    {
      id: 'exp-2',
      role: 'Frontend Developer Intern',
      company: 'PulseGrid Analytics',
      location: 'Remote',
      duration: 'May 2024 - Jul 2024',
      highlights: [
        'Developed responsive analytics dashboards with React, Tailwind CSS, and Axios.',
        'Refactored reusable filter and table components, reducing duplicate UI code across 4 views.',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'CareerAI — Semantic Job & Career Copilot',
      techStack: ['React', 'Node.js', 'FastAPI', 'LangGraph', 'Qdrant', 'Gemini API'],
      description:
        'Multi-service platform for structured resume parsing, hybrid semantic job ranking, and tool-augmented career coaching.',
    },
    {
      id: 'proj-2',
      name: 'DocuQuery — Hybrid RAG Knowledge Assistant',
      techStack: ['Python', 'FastAPI', 'Sentence Transformers', 'MongoDB', 'Docker'],
      description:
        'Built an internal documentation assistant supporting semantic search with citation grounding and query logging.',
    },
  ],
};

export const MOCK_JOBS = [
  {
    id: 'job-1',
    title: 'Junior Applied AI Engineer',
    company: 'Veridian AI',
    location: 'Bengaluru',
    workMode: 'Hybrid',
    jobType: 'Full-time',
    experienceLevel: 'Entry Level (0-2 yrs)',
    salaryRange: '$18k - $26k / yr (INR 15L - 22L)',
    postedAgo: '2 days ago',
    baseSemanticScore: 93,
    requiredSkills: ['Python', 'FastAPI', 'LangGraph', 'Qdrant', 'Docker', 'REST APIs'],
    niceToHaveSkills: ['PyTorch', 'Evaluation Frameworks', 'Redis'],
    description:
      'Join our applied AI engineering team to build retrieval-augmented workflows, structured extraction pipelines, and tool-using LLM agents for enterprise talent intelligence.',
    responsibilities: [
      'Design and maintain FastAPI microservices wrapping LLM reasoning and embedding pipelines.',
      'Optimize Qdrant hybrid retrieval queries and evaluate answer faithfulness.',
      'Collaborate with full-stack engineers to ship reliable user-facing AI features.',
    ],
  },
  {
    id: 'job-2',
    title: 'Full-Stack Software Engineer (AI Products)',
    company: 'ScaleForge Cloud',
    location: 'Remote',
    workMode: 'Remote',
    jobType: 'Full-time',
    experienceLevel: 'Entry Level (0-2 yrs)',
    salaryRange: '$75k - $95k / yr',
    postedAgo: '1 day ago',
    baseSemanticScore: 90,
    requiredSkills: ['React', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS', 'REST APIs'],
    niceToHaveSkills: ['TypeScript', 'Docker', 'Python'],
    description:
      'Build customer-facing SaaS workflows and AI copilots in React and Node.js while partnering closely with ML researchers on streaming APIs.',
    responsibilities: [
      'Architect modular React interfaces with Tailwind CSS and clean API client layers.',
      'Build secure Express services with MongoDB persistence, rate limiting, and JWT auth.',
      'Ship high-craft UI experiences with accessible components and fast page loads.',
    ],
  },
  {
    id: 'job-3',
    title: 'Backend Engineer — Python & Vector Search',
    company: 'Kinetix Search',
    location: 'Hyderabad',
    workMode: 'Hybrid',
    jobType: 'Full-time',
    experienceLevel: 'Entry Level (0-2 yrs)',
    salaryRange: '$16k - $24k / yr (INR 14L - 20L)',
    postedAgo: '3 days ago',
    baseSemanticScore: 87,
    requiredSkills: ['Python', 'FastAPI', 'Qdrant', 'Docker', 'SQL', 'MongoDB'],
    niceToHaveSkills: ['Kubernetes', 'Kafka', 'Sentence Transformers'],
    description:
      'Help scale our semantic search engine powering millions of structured candidate and document queries daily.',
    responsibilities: [
      'Build low-latency indexing and retrieval endpoints in Python and FastAPI.',
      'Tune vector database payload filters and embedding batch pipelines.',
      'Write automated integration tests and performance benchmarks.',
    ],
  },
  {
    id: 'job-4',
    title: 'AI Agent & LLM Engineer',
    company: 'Aetheris Labs',
    location: 'Remote',
    workMode: 'Remote',
    jobType: 'Full-time',
    experienceLevel: 'Mid Level (2-5 yrs)',
    salaryRange: '$95k - $125k / yr',
    postedAgo: '4 days ago',
    baseSemanticScore: 84,
    requiredSkills: ['Python', 'LangGraph', 'FastAPI', 'Docker', 'Kubernetes', 'PyTorch'],
    niceToHaveSkills: ['LangSmith', 'OpenTelemetry', 'AWS'],
    description:
      'Architect multi-step agentic workflows with deterministic guardrails, tool orchestration, and automated evaluation pipelines.',
    responsibilities: [
      'Design stateful LangGraph agents with tool calling and persistent memory.',
      'Build LLM-as-a-judge evaluation suites to prevent regressions across model updates.',
      'Deploy containerized inference services to Kubernetes clusters.',
    ],
  },
  {
    id: 'job-5',
    title: 'Software Engineer I — Frontend (React)',
    company: 'OrbitFlow Systems',
    location: 'Bengaluru',
    workMode: 'Onsite',
    jobType: 'Full-time',
    experienceLevel: 'Entry Level (0-2 yrs)',
    salaryRange: '$14k - $20k / yr (INR 12L - 17L)',
    postedAgo: '5 days ago',
    baseSemanticScore: 81,
    requiredSkills: ['React', 'JavaScript', 'Tailwind CSS', 'REST APIs', 'TypeScript'],
    niceToHaveSkills: ['Next.js', 'Playwright', 'GraphQL'],
    description:
      'Own core dashboard modules for our B2B workflow automation suite, focusing on responsive UI design and state management.',
    responsibilities: [
      'Translate Figma specs into reusable React and Tailwind components.',
      'Optimize client-side rendering performance and bundle size.',
      'Partner with backend engineers on API contracts and error states.',
    ],
  },
  {
    id: 'job-6',
    title: 'Machine Learning Engineering Intern',
    company: 'DeepHarbor Research',
    location: 'Remote',
    workMode: 'Remote',
    jobType: 'Internship',
    experienceLevel: 'Student / Intern',
    salaryRange: '$2,500 / mo',
    postedAgo: '1 day ago',
    baseSemanticScore: 85,
    requiredSkills: ['Python', 'Sentence Transformers', 'PyTorch', 'FastAPI', 'Docker'],
    niceToHaveSkills: ['Qdrant', 'Hugging Face', 'Weights & Biases'],
    description:
      '6-month engineering internship focused on embedding fine-tuning, semantic retrieval benchmarking, and lightweight FastAPI prototypes.',
    responsibilities: [
      'Evaluate open-source embedding models on domain-specific retrieval datasets.',
      'Build reproducible Python evaluation scripts and API demos.',
    ],
  },
  {
    id: 'job-7',
    title: 'Node.js Backend Developer',
    company: 'FinLedger Core',
    location: 'Mumbai',
    workMode: 'Hybrid',
    jobType: 'Full-time',
    experienceLevel: 'Entry Level (0-2 yrs)',
    salaryRange: '$15k - $21k / yr (INR 13L - 18L)',
    postedAgo: '6 days ago',
    baseSemanticScore: 78,
    requiredSkills: ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'Docker', 'Redis'],
    niceToHaveSkills: ['TypeScript', 'PostgreSQL', 'AWS'],
    description:
      'Build resilient financial workflow APIs with strong input validation, audit logging, and high test reliability.',
    responsibilities: [
      'Design Express APIs backed by MongoDB and Redis caching.',
      'Maintain strict schema validation, rate limiting, and JWT security.',
    ],
  },
  {
    id: 'job-8',
    title: 'Platform & MLOps Engineer',
    company: 'Stratos Compute',
    location: 'San Francisco',
    workMode: 'Remote',
    jobType: 'Contract',
    experienceLevel: 'Senior (5+ yrs)',
    salaryRange: '$75 - $95 / hr',
    postedAgo: '1 week ago',
    baseSemanticScore: 68,
    requiredSkills: ['Kubernetes', 'Terraform', 'AWS', 'Python', 'Docker', 'CI/CD'],
    niceToHaveSkills: ['vLLM', 'Prometheus', 'Go'],
    description:
      'Manage multi-region GPU inference infrastructure, autoscaling pipelines, and observability dashboards for production AI workloads.',
    responsibilities: [
      'Automate Kubernetes cluster provisioning with Terraform.',
      'Build CI/CD deployment pipelines and GPU utilization monitors.',
    ],
  },
  {
    id: 'job-9',
    title: 'Graduate Software Engineer — AI & Data',
    company: 'Nimbus Commerce',
    location: 'Bengaluru',
    workMode: 'Hybrid',
    jobType: 'Full-time',
    experienceLevel: 'Student / Intern',
    salaryRange: '$14k - $18k / yr (INR 12L - 15L)',
    postedAgo: '2 days ago',
    baseSemanticScore: 86,
    requiredSkills: ['Python', 'JavaScript', 'React', 'SQL', 'MongoDB', 'Docker'],
    niceToHaveSkills: ['FastAPI', 'Node.js', 'Tailwind CSS'],
    description:
      'New-grad rotational engineering track rotating across product engineering, semantic catalog search, and conversational shopping assistants.',
    responsibilities: [
      'Ship full-stack features across React, Node.js, and Python services.',
      'Participate in code reviews, architecture specs, and on-call shadowing.',
    ],
  },
  {
    id: 'job-10',
    title: 'Product Engineer (LLM Interfaces)',
    company: 'PromptCraft Studio',
    location: 'London',
    workMode: 'Remote',
    jobType: 'Full-time',
    experienceLevel: 'Mid Level (2-5 yrs)',
    salaryRange: '$85k - $110k / yr',
    postedAgo: '4 days ago',
    baseSemanticScore: 83,
    requiredSkills: ['React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'LangGraph', 'REST APIs'],
    niceToHaveSkills: ['Streaming SSE', 'FastAPI', 'Postgres'],
    description:
      'Craft intuitive human-in-the-loop AI interfaces, agent inspection views, and real-time collaborative workspaces.',
    responsibilities: [
      'Build responsive React frontends for multi-step AI workflows.',
      'Collaborate on prompt/agent API contracts and latency optimization.',
    ],
  },
];

export const INITIAL_CHAT_MESSAGES = [
  {
    id: 'msg-1',
    role: 'assistant',
    content:
      'Hello Aarav! I have reviewed your active resume (ATS Score: 86/100) and your target roles in AI Software Engineering and Full-Stack Development. Ask me about skill gaps, tailored job matches, resume improvements, or interview prep.',
    timestamp: '2026-11-25T09:00:00Z',
    toolsUsed: ['resume_summary_tool'],
  },
];

export const SUGGESTED_QUESTIONS = [
  'Which jobs match my current skills best?',
  'What skills am I missing for AI Agent Engineer roles?',
  'How can I improve my resume projects for ATS?',
  'Give me a 4-week roadmap to close my top skill gaps.',
];

export const EXPERIENCE_LEVEL_OPTIONS = [
  'Student / Intern',
  'Entry Level (0-2 yrs)',
  'Mid Level (2-5 yrs)',
  'Senior (5+ yrs)',
];

export const COMMON_LOCATIONS = [
  'Bengaluru',
  'Remote',
  'Hyderabad',
  'Mumbai',
  'San Francisco',
  'London',
];
