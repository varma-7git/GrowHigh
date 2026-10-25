// Sample content for the screens. Each block is replaced by real data as the matching backend module is built.
export const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
export const WEEK = [0, 0, 0, 0, 0, 0, 0];

const BANK = [
  ["If A is a 3×3 matrix and |A| = 4, what is |2A|?", ["8", "16", "32", "64"], 2, "For an n×n matrix, |kA| = kⁿ|A|. Here n = 3, so |2A| = 2³ × 4 = 32."],
  ["If A is a 2×2 identity matrix, what is the determinant of A?", ["0", "1", "2", "4"], 1, "The identity matrix has determinant 1."],
  ["What is the derivative of x³?", ["x²", "3x²", "3x", "x³"], 1, "By the power rule, d(xⁿ)/dx = n·xⁿ⁻¹, so d(x³)/dx = 3x²."],
  ["What are the roots of z² + 1 = 0?", ["±i", "±1", "0", "i only"], 0, "z² = −1, so z = ±i."],
  ["What is the SI unit of force?", ["Joule", "Watt", "Pascal", "Newton"], 3, "Force is measured in newtons (N)."],
  ["Which of these is a transpose property?", ["(AB)ᵀ = AᵀBᵀ", "(AB)ᵀ = BᵀAᵀ", "(A+B)ᵀ = AB", "Aᵀᵀ = 2A"], 1, "The transpose of a product reverses the order: (AB)ᵀ = BᵀAᵀ."],
];
export const makeQs = (n) => Array.from({ length: n }, (_, i) => { const [q, o, a, e] = BANK[i % BANK.length]; return { q, o, a, e, topic: i % 2 ? "Differentiation" : "Determinants" }; });

export const STUDENTS = []; // filled from the real roster when the faculty module is built
export const BRANCH_PAPERS = ["Ceramic Technology", "Chemical Engineering", "Civil Engineering", "CSE", "EEE", "ECE", "Electronics & Instrumentation", "Mechanical", "Metallurgical", "Mining", "Pharmacy", "Agricultural", "BioTechnology", "B.Sc Mathematics"];
export const CSE_SUBJECTS = [
  ["Digital Electronics", "Logic gates, circuits and number systems", 8], ["Software Engineering", "Lifecycle, testing and requirements", 8],
  ["Computer Organization & Microprocessors", "Architecture, memory and instructions", 12], ["Data Structures with C", "Lists, stacks, trees and algorithms", 10],
  ["Computer Networks", "Protocols, addressing and network layers", 12], ["Operating Systems", "Processes, memory and scheduling", 12],
  ["DBMS", "Relational models, SQL and normalisation", 10], ["OOP using C++", "Classes, inheritance and polymorphism", 10],
  ["Java Programming & Web Technologies", "Java fundamentals and web concepts", 8],
];
export const TOPICS = {
  Mathematics: ["Matrices", "Partial fractions", "Trigonometry", "Complex numbers", "Analytical geometry", "Differentiation and applications", "Integration and applications", "Differential equations"],
  Physics: ["Units and dimensions", "Vectors", "Kinematics and friction", "Work, power and energy", "SHM and acoustics", "Heat and thermodynamics", "Modern physics"],
  Chemistry: ["Atomic structure", "Chemical bonding", "Solutions", "Acids and bases", "Electrochemistry", "Water technology", "Corrosion", "Polymers", "Fuels", "Environmental chemistry"],
};
export const YEARS = Array.from({ length: 22 }, (_, i) => 2025 - i);

const NONE = [["Assigned", "0", "Nothing assigned yet"], ["Completed", "0", "Your results appear here"], ["Average", "—", "After your first test"]];
export const TESTS = {
  daily: { title: "Daily tests", sub: "A short assessment, a clear insight and a stronger study habit.", stats: NONE, due: [], done: [], head: "Completed assessments" },
  weekly: { title: "Weekly tests", sub: "Connect the week's learning and see where your understanding stands.", stats: [["Upcoming", "0", "Nothing scheduled yet"], ["Completed", "0", "Weekly checkpoints"], ["Best score", "—", "After your first test"]], due: [], done: [], head: "Your weekly results" },
  cumulative: { title: "Cumulative tests", sub: "Bring your common and branch subjects together in a full-length checkpoint.", stats: [], due: [], done: [], head: "Completed cumulative tests" },
  mock: { title: "AP ECET mock test", sub: "A full-length exam rehearsal, with the rules visible before you begin.", stats: [["Questions", "Up to 200", "One mark each"], ["Time limit", "54 s each", "3 hours for 200"], ["Negative marking", "None", "Instant result"]], due: [], done: [], head: "Previous mock attempts" },
};
