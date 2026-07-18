/**
 * Beginner-friendly explainers for each branch family — what the branch is
 * about, the core topics you study, skills you build, and where it leads. This
 * is general educational content (not per-college data) so a student new to
 * engineering can quickly understand what a branch actually involves.
 */

export type BranchGuide = {
  tagline: string;
  about: string;
  topics: string[];
  skills: string[];
  careers: string[];
  goodFit: string;
};

const GUIDES: Record<string, BranchGuide> = {
  "Computer, IT & AI": {
    tagline: "Build software, data systems and intelligent machines.",
    about:
      "Computer, IT and AI branches teach how software and data-driven systems are designed, built and scaled — from writing code and structuring data to training models that learn. It's currently the most in-demand engineering field, powering apps, websites, cloud platforms and AI.",
    topics: [
      "Programming (C/C++, Java, Python)",
      "Data Structures & Algorithms",
      "Operating Systems",
      "Databases (DBMS / SQL)",
      "Computer Networks",
      "Web & App Development",
      "Machine Learning & AI",
      "Cloud & DevOps",
      "Software Engineering",
      "Cybersecurity basics",
    ],
    skills: ["Coding & problem-solving", "System design", "Data handling", "ML/AI foundations", "Debugging"],
    careers: ["Software Engineer", "Data Scientist / Analyst", "ML / AI Engineer", "Full-stack Developer", "Cloud / DevOps Engineer"],
    goodFit: "You enjoy logic, problem-solving and building things with a computer.",
  },
  "Electronics & Telecom": {
    tagline: "Design the chips, circuits and networks behind modern devices.",
    about:
      "Electronics & Telecommunication blends hardware and communication — you learn how electronic circuits, embedded chips and wireless networks are designed and made to talk to each other. It sits at the crossroads of hardware and software and feeds into VLSI, embedded systems, IoT and 5G.",
    topics: [
      "Analog & Digital Electronics",
      "Signals & Systems",
      "Microcontrollers & Embedded Systems",
      "Communication Systems",
      "Digital Signal Processing",
      "VLSI Design",
      "Electromagnetics",
      "Control Systems",
      "Internet of Things (IoT)",
    ],
    skills: ["Circuit design", "Embedded programming", "Signal analysis", "PCB & hardware", "C / Python"],
    careers: ["Embedded / Firmware Engineer", "VLSI Design Engineer", "Telecom / Network Engineer", "IoT Developer", "Software roles"],
    goodFit: "You like both hardware and code, and how devices work inside.",
  },
  Electrical: {
    tagline: "Power the world — from grids and motors to renewable energy.",
    about:
      "Electrical Engineering is about generating, transmitting and controlling electrical power, plus the machines and systems that use it. You'll study power systems, motors and control, with growing focus on renewable energy and EVs.",
    topics: [
      "Circuit Theory",
      "Power Systems",
      "Electrical Machines",
      "Power Electronics",
      "Control Systems",
      "Renewable Energy",
      "Switchgear & Protection",
      "Electric Drives",
      "Instrumentation",
    ],
    skills: ["Power system analysis", "Control design", "Machine fundamentals", "Safety & standards"],
    careers: ["Electrical / Power Engineer", "Control & Automation Engineer", "Renewable Energy Engineer", "EV / Power Electronics Engineer"],
    goodFit: "You're drawn to energy, power systems and large-scale infrastructure.",
  },
  "Mechanical & Allied": {
    tagline: "Design and build the machines and systems that move the world.",
    about:
      "Mechanical Engineering is the broadest discipline — the science of designing, analysing and manufacturing physical machines and systems. From engines and robots to manufacturing lines and thermal systems, it's the backbone of the physical economy.",
    topics: [
      "Engineering Mechanics",
      "Thermodynamics",
      "Fluid Mechanics",
      "Strength of Materials",
      "Machine Design",
      "Manufacturing Processes",
      "CAD / CAM",
      "Heat Transfer",
      "Robotics & Automation",
      "Automobile Engineering",
    ],
    skills: ["Design & CAD", "Analysis & simulation", "Manufacturing know-how", "Thermal/mechanical reasoning"],
    careers: ["Design Engineer", "Manufacturing / Production Engineer", "Automotive Engineer", "CAD / CAE Engineer", "Maintenance Engineer"],
    goodFit: "You love machines, design and how physical things actually work.",
  },
  Civil: {
    tagline: "Plan and build infrastructure — buildings, roads, bridges and cities.",
    about:
      "Civil Engineering designs and constructs the built environment: buildings, bridges, roads, dams and water systems. It combines structural analysis, materials and project management to shape how cities grow.",
    topics: [
      "Structural Analysis",
      "Building Materials & Concrete",
      "Geotechnical Engineering",
      "Surveying",
      "Transportation Engineering",
      "Water Resources",
      "Environmental Engineering",
      "Construction Management",
      "RCC / Steel Design",
    ],
    skills: ["Structural design", "Surveying & drafting (AutoCAD)", "Estimation & planning", "Site management"],
    careers: ["Structural / Site Engineer", "Construction Manager", "Transportation / Water Engineer", "Urban Planner"],
    goodFit: "You want to build lasting infrastructure and enjoy design plus fieldwork.",
  },
  "Chemical & Allied": {
    tagline: "Turn raw materials into products — fuels, medicines and materials.",
    about:
      "Chemical Engineering applies chemistry, physics and math to design processes that convert raw materials into useful products at scale — fuels, pharmaceuticals, food, polymers and specialty chemicals. It spans process design, reaction engineering and plant operations.",
    topics: [
      "Chemical Process Principles",
      "Thermodynamics",
      "Fluid Mechanics",
      "Heat & Mass Transfer",
      "Reaction Engineering",
      "Process Control",
      "Plant Design",
      "Separation Processes",
      "Process Safety",
    ],
    skills: ["Process design", "Reaction & transport analysis", "Simulation", "Safety & scale-up"],
    careers: ["Process Engineer", "Production / Plant Engineer", "Process Safety / Quality Engineer", "R&D Engineer"],
    goodFit: "You like chemistry + math and turning lab reactions into real processes.",
  },
  Textile: {
    tagline: "Engineer fibres, fabrics and modern textile manufacturing.",
    about:
      "Textile Engineering covers the science and technology of fibres, yarns and fabrics — from manufacturing and processing to technical textiles used in medicine, sport and industry. Maharashtra has a strong textile-industry base.",
    topics: [
      "Fibre Science",
      "Yarn & Fabric Manufacturing",
      "Textile Chemistry & Dyeing",
      "Textile Testing",
      "Garment Technology",
      "Technical Textiles",
      "Process & Quality Control",
    ],
    skills: ["Material & process knowledge", "Quality testing", "Production planning"],
    careers: ["Textile / Production Engineer", "Quality Engineer", "Process Engineer", "Technical-textiles roles"],
    goodFit: "You're interested in materials, manufacturing and the textile industry.",
  },
  "Bio & Food": {
    tagline: "Apply engineering to living systems, food and biotech.",
    about:
      "Bio and Food engineering apply engineering principles to biological systems — biotechnology, bioprocessing and food technology. You work where biology, chemistry and process engineering meet, in areas from pharma to food production.",
    topics: [
      "Biochemistry & Microbiology",
      "Bioprocess Engineering",
      "Food Technology",
      "Fermentation Technology",
      "Genetic Engineering basics",
      "Food Preservation & Safety",
      "Unit Operations",
      "Quality Control",
    ],
    skills: ["Lab & bioprocess techniques", "Quality & safety", "Process fundamentals"],
    careers: ["Bioprocess / Biotech Engineer", "Food Technologist", "Quality / R&D roles", "Pharma production"],
    goodFit: "You enjoy biology + chemistry applied to health, food or biotech.",
  },
  Other: {
    tagline: "Specialised and interdisciplinary engineering branches.",
    about:
      "This group covers specialised or emerging branches that combine ideas across disciplines. Explore the colleges and cutoffs below to understand each program's specific focus.",
    topics: ["Core engineering fundamentals", "Mathematics & Sciences", "Discipline-specific subjects"],
    skills: ["Problem-solving", "Analysis", "Discipline-specific skills"],
    careers: ["Varies by specialisation"],
    goodFit: "You want a specialised or interdisciplinary engineering path.",
  },
};

export function guideForFamily(family: string | null | undefined): BranchGuide {
  return (family && GUIDES[family]) || GUIDES.Other;
}
