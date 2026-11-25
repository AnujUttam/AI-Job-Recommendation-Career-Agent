import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Job } from '../models/Job.js';

export const SEED_JOBS = [
  {
    title: 'AI Engineer',
    company: 'Veridian AI',
    description:
      'Design and ship retrieval-augmented generation pipelines, structured document extraction workflows, and tool-using LLM agents for enterprise talent intelligence.',
    requiredSkills: ['Python', 'FastAPI', 'LangGraph', 'Qdrant', 'Docker', 'REST APIs'],
    niceToHaveSkills: ['PyTorch', 'Evaluation Frameworks', 'Redis'],
    responsibilities: [
      'Build FastAPI microservices wrapping LLM reasoning and embedding workflows.',
      'Optimize Qdrant hybrid retrieval queries and evaluate answer faithfulness.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Bengaluru',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 16L - 24L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/veridian-ai/ai-engineer',
  },
  {
    title: 'Machine Learning Engineer',
    company: 'DeepHarbor Research',
    description:
      'Train, benchmark, and deploy dense embedding and ranking models powering semantic search across millions of technical documents.',
    requiredSkills: ['Python', 'PyTorch', 'Sentence Transformers', 'FastAPI', 'Docker'],
    niceToHaveSkills: ['Qdrant', 'Kubernetes', 'Weights & Biases'],
    responsibilities: [
      'Fine-tune bi-encoder and cross-encoder retrieval models.',
      'Run offline Precision@K and MRR evaluation pipelines.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'Remote',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: '$105k - $135k / yr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/deepharbor/ml-engineer',
  },
  {
    title: 'Full Stack Developer',
    company: 'ScaleForge Cloud',
    description:
      'Build customer-facing SaaS workflows and AI copilots in React and Node.js while partnering closely with ML engineers on backend APIs.',
    requiredSkills: ['React', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS', 'REST APIs'],
    niceToHaveSkills: ['TypeScript', 'Docker', 'Python'],
    responsibilities: [
      'Architect modular React interfaces with Tailwind CSS and Axios.',
      'Build secure Express services with MongoDB persistence and JWT auth.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Remote',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: '$75k - $95k / yr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/scaleforge/fullstack-dev',
  },
  {
    title: 'React Developer',
    company: 'OrbitFlow Systems',
    description:
      'Own core frontend dashboard modules for our B2B workflow automation suite, focusing on responsive UI design, accessibility, and clean state management.',
    requiredSkills: ['React', 'JavaScript', 'Tailwind CSS', 'REST APIs', 'TypeScript'],
    niceToHaveSkills: ['Next.js', 'Playwright', 'GraphQL'],
    responsibilities: [
      'Build reusable React and Tailwind components from product specs.',
      'Optimize client-side rendering performance and bundle size.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Bengaluru',
    employmentType: 'Full-time',
    workMode: 'Onsite',
    salaryRange: 'INR 12L - 18L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/orbitflow/react-developer',
  },
  {
    title: 'Node.js Developer',
    company: 'FinLedger Core',
    description:
      'Build resilient financial workflow APIs with strong schema validation, audit logging, and high automated test reliability.',
    requiredSkills: ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'Docker', 'Redis'],
    niceToHaveSkills: ['TypeScript', 'PostgreSQL', 'AWS'],
    responsibilities: [
      'Design Express APIs backed by MongoDB and Redis caching.',
      'Maintain strict input validation, rate limiting, and JWT security.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Mumbai',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 13L - 19L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/finledger/nodejs-developer',
  },
  {
    title: 'Python Developer',
    company: 'Kinetix Search',
    description:
      'Build asynchronous ingestion workers, data normalization pipelines, and FastAPI services powering real-time semantic search.',
    requiredSkills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'REST APIs', 'Git'],
    niceToHaveSkills: ['Qdrant', 'Celery', 'Redis'],
    responsibilities: [
      'Develop clean Python services and background workers.',
      'Write unit and integration tests for retrieval APIs.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Hyderabad',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 14L - 20L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/kinetix/python-developer',
  },
  {
    title: 'Java Developer',
    company: 'ApexCore Banking Tech',
    description:
      'Develop high-throughput enterprise microservices in Java and Spring Boot supporting payment settlement and ledger reconciliation.',
    requiredSkills: ['Java', 'Spring Boot', 'SQL', 'PostgreSQL', 'REST APIs', 'Docker'],
    niceToHaveSkills: ['Kafka', 'Kubernetes', 'AWS'],
    responsibilities: [
      'Build and maintain Spring Boot microservices with strict SLA targets.',
      'Optimize relational queries and transactional consistency.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'Pune',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 18L - 26L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/apexcore/java-developer',
  },
  {
    title: 'Backend Developer',
    company: 'CloudPulse Telemetry',
    description:
      'Design scalable REST and event-driven APIs to ingest, query, and alert on distributed application telemetry.',
    requiredSkills: ['Node.js', 'Python', 'MongoDB', 'SQL', 'Docker', 'REST APIs'],
    niceToHaveSkills: ['Go', 'Kafka', 'Prometheus'],
    responsibilities: [
      'Design database schemas, indexing strategies, and API contracts.',
      'Improve p95 endpoint latency and service observability.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Bengaluru',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 15L - 22L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/cloudpulse/backend-developer',
  },
  {
    title: 'Software Engineer',
    company: 'Nimbus Commerce',
    description:
      'New-grad and early-career engineering role rotating across product engineering, semantic catalog search, and conversational shopping assistants.',
    requiredSkills: ['Python', 'JavaScript', 'React', 'SQL', 'MongoDB', 'Git'],
    niceToHaveSkills: ['FastAPI', 'Node.js', 'Docker'],
    responsibilities: [
      'Ship full-stack features across React, Node.js, and Python services.',
      'Participate in code reviews and architecture design docs.',
    ],
    experienceLevel: 'Student / Intern',
    location: 'Bengaluru',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 12L - 16L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/nimbus/software-engineer',
  },
  {
    title: 'Data Analyst',
    company: 'MetricWave Insights',
    description:
      'Analyze product funnels, job matching conversion rates, and retention cohorts using SQL, Python, and interactive BI dashboards.',
    requiredSkills: ['SQL', 'Python', 'Pandas', 'Excel', 'Data Visualization'],
    niceToHaveSkills: ['Tableau', 'Power BI', 'dbt'],
    responsibilities: [
      'Build executive dashboards tracking funnel health and experiment results.',
      'Partner with product teams to define KPIs and A/B test metrics.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Hyderabad',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 9L - 14L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/metricwave/data-analyst',
  },
  {
    title: 'Senior Java Backend Engineer',
    company: 'TransitGrid Logistics',
    description:
      'Lead architecture of distributed shipment routing and real-time tracking services built on Java 21, Spring Boot, and Kafka.',
    requiredSkills: ['Java', 'Spring Boot', 'Kafka', 'Kubernetes', 'PostgreSQL', 'Docker'],
    niceToHaveSkills: ['AWS', 'Redis', 'Terraform'],
    responsibilities: [
      'Lead design reviews and mentor junior backend engineers.',
      'Architect resilient event-driven microservices.',
    ],
    experienceLevel: 'Senior (5+ yrs)',
    location: 'Bengaluru',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 32L - 44L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/transitgrid/senior-java',
  },
  {
    title: 'LLM Agent & Evaluation Engineer',
    company: 'Aetheris Labs',
    description:
      'Architect multi-step agentic workflows with deterministic guardrails, tool calling, and automated LLM-as-a-judge evaluation suites.',
    requiredSkills: ['Python', 'LangGraph', 'FastAPI', 'Docker', 'Qdrant'],
    niceToHaveSkills: ['LangSmith', 'OpenTelemetry', 'Kubernetes'],
    responsibilities: [
      'Design stateful LangGraph agents with persistent conversation memory.',
      'Prevent prompt/retrieval regressions with automated eval pipelines.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'Remote',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: '$100k - $130k / yr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/aetheris/llm-agent-engineer',
  },
  {
    title: 'Frontend React Intern',
    company: 'PulseGrid Analytics',
    description:
      'Summer/winter engineering internship building responsive data visualizations and reusable Tailwind UI components.',
    requiredSkills: ['React', 'JavaScript', 'Tailwind CSS', 'Git'],
    niceToHaveSkills: ['TypeScript', 'Axios', 'Vite'],
    responsibilities: [
      'Implement clean UI screens and connect them to REST endpoints.',
      'Write component tests and refine mobile responsiveness.',
    ],
    experienceLevel: 'Student / Intern',
    location: 'Remote',
    employmentType: 'Internship',
    workMode: 'Remote',
    salaryRange: 'INR 35k - 50k / mo',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/pulsegrid/frontend-intern',
  },
  {
    title: 'AI Engineering Intern',
    company: 'NovaStack Labs',
    description:
      '6-month applied AI internship working on PDF resume parsing, embedding model evaluation, and semantic job matching.',
    requiredSkills: ['Python', 'FastAPI', 'Sentence Transformers', 'MongoDB', 'Git'],
    niceToHaveSkills: ['Qdrant', 'Docker', 'LangGraph'],
    responsibilities: [
      'Prototype extraction prompts and benchmark retrieval accuracy.',
      'Build lightweight FastAPI endpoints and automated test scripts.',
    ],
    experienceLevel: 'Student / Intern',
    location: 'Bengaluru',
    employmentType: 'Internship',
    workMode: 'Hybrid',
    salaryRange: 'INR 40k - 60k / mo',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/novastack/ai-intern',
  },
  {
    title: 'Product Engineer (LLM Interfaces)',
    company: 'PromptCraft Studio',
    description:
      'Craft intuitive human-in-the-loop AI interfaces, streaming chat experiences, and collaborative agent workspaces.',
    requiredSkills: ['React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'REST APIs'],
    niceToHaveSkills: ['LangGraph', 'FastAPI', 'PostgreSQL'],
    responsibilities: [
      'Build responsive React frontends for multi-step AI workflows.',
      'Collaborate on streaming API contracts and UX polish.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'London',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: '$85k - $115k / yr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/promptcraft/product-engineer',
  },
  {
    title: 'Senior Full Stack Developer',
    company: 'Helios SaaS',
    description:
      'Drive end-to-end architecture across React, Node.js, and MongoDB Atlas for our multi-tenant workforce analytics platform.',
    requiredSkills: ['React', 'TypeScript', 'Node.js', 'Express', 'MongoDB', 'AWS'],
    niceToHaveSkills: ['Docker', 'Redis', 'GraphQL'],
    responsibilities: [
      'Own critical product verticals from schema design to frontend release.',
      'Establish coding standards, CI checks, and observability.',
    ],
    experienceLevel: 'Senior (5+ yrs)',
    location: 'San Francisco',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: '$140k - $175k / yr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/helios/senior-fullstack',
  },
  {
    title: 'Platform & MLOps Engineer',
    company: 'Stratos Compute',
    description:
      'Manage multi-region GPU inference infrastructure, autoscaling pipelines, and observability dashboards for production AI workloads.',
    requiredSkills: ['Kubernetes', 'Terraform', 'AWS', 'Python', 'Docker', 'CI/CD'],
    niceToHaveSkills: ['vLLM', 'Prometheus', 'Go'],
    responsibilities: [
      'Automate Kubernetes cluster provisioning with Terraform.',
      'Monitor inference latency and GPU utilization.',
    ],
    experienceLevel: 'Senior (5+ yrs)',
    location: 'San Francisco',
    employmentType: 'Contract',
    workMode: 'Remote',
    salaryRange: '$80 - $100 / hr',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/stratos/mlops-engineer',
  },
  {
    title: 'Data Engineer (Python & SQL)',
    company: 'DataStream Systems',
    description:
      'Build reliable ETL pipelines transforming raw clickstream and job-board feeds into analytics-ready warehouse tables.',
    requiredSkills: ['Python', 'SQL', 'PostgreSQL', 'Docker', 'Airflow'],
    niceToHaveSkills: ['dbt', 'Spark', 'AWS'],
    responsibilities: [
      'Maintain daily batch and micro-batch ingestion DAGs.',
      'Implement automated data quality assertions.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'Hyderabad',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 20L - 28L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/datastream/data-engineer',
  },
  {
    title: 'Junior Python & Django/FastAPI Developer',
    company: 'BrightPath EdTech',
    description:
      'Help build adaptive learning APIs, quiz evaluation services, and student progress dashboards.',
    requiredSkills: ['Python', 'FastAPI', 'SQL', 'REST APIs', 'Git'],
    niceToHaveSkills: ['React', 'Docker', 'MongoDB'],
    responsibilities: [
      'Implement backend features and automated Pytest coverage.',
      'Integrate third-party LLM tutoring services safely.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Remote',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: 'INR 10L - 15L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/brightpath/python-dev',
  },
  {
    title: 'Business & Product Data Analyst',
    company: 'CartFlow Retail',
    description:
      'Partner with growth and engineering teams to analyze customer journeys, pricing elasticity, and search relevance.',
    requiredSkills: ['SQL', 'Python', 'Pandas', 'Power BI', 'Statistics'],
    niceToHaveSkills: ['BigQuery', 'Looker', 'Excel'],
    responsibilities: [
      'Design SQL cohorts and churn diagnostics.',
      'Present weekly experiment insights to leadership.',
    ],
    experienceLevel: 'Entry Level (0-2 yrs)',
    location: 'Mumbai',
    employmentType: 'Full-time',
    workMode: 'Onsite',
    salaryRange: 'INR 10L - 14L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/cartflow/data-analyst',
  },
  {
    title: 'Full Stack Java + React Engineer',
    company: 'EnterpriseGrid Solutions',
    description:
      'Build modern enterprise portals combining Java Spring Boot APIs with responsive React and Tailwind frontends.',
    requiredSkills: ['Java', 'Spring Boot', 'React', 'JavaScript', 'SQL', 'REST APIs'],
    niceToHaveSkills: ['Docker', 'TypeScript', 'Kubernetes'],
    responsibilities: [
      'Deliver full-stack features across Spring Boot and React.',
      'Maintain clean API documentation and unit test suites.',
    ],
    experienceLevel: 'Mid Level (2-5 yrs)',
    location: 'Chennai',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    salaryRange: 'INR 17L - 24L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/enterprisegrid/java-react',
  },
  {
    title: 'Associate Software Engineer (Node.js & React)',
    company: 'LaunchPad Labs',
    description:
      'Join a fast-moving product squad building internal developer portals and AI-assisted onboarding workflows.',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS'],
    niceToHaveSkills: ['Docker', 'TypeScript', 'Git'],
    responsibilities: [
      'Implement REST APIs and frontend views from product specs.',
      'Collaborate in agile sprints and peer code reviews.',
    ],
    experienceLevel: 'Student / Intern',
    location: 'Remote',
    employmentType: 'Full-time',
    workMode: 'Remote',
    salaryRange: 'INR 10L - 14L',
    source: 'CareerAI Curated',
    applyUrl: 'https://careers.example.com/launchpad/associate-swe',
  },
];

export const seedJobsDatabase = async ({ clearExisting = false } = {}) => {
  if (clearExisting) {
    await Job.deleteMany({});
  }

  let inserted = 0;
  let skipped = 0;

  for (const jobData of SEED_JOBS) {
    const exists = await Job.findOne({
      title: jobData.title,
      company: jobData.company,
    }).lean();

    if (exists) {
      skipped += 1;
    } else {
      await Job.create(jobData);
      inserted += 1;
    }
  }

  return { totalSeedItems: SEED_JOBS.length, inserted, skipped };
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  (async () => {
    const connected = await connectDatabase();
    if (!connected) {
      console.error('[Seed] Cannot seed jobs without a valid MONGO_URI.');
      process.exit(1);
    }

    const result = await seedJobsDatabase();
    console.log(
      `[Seed] Completed: ${result.inserted} inserted, ${result.skipped} already existed (total seed catalog: ${result.totalSeedItems}).`
    );
    await disconnectDatabase();
  })();
}
