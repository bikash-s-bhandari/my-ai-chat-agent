import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Input data
const data = {
    "job": {
      "id": 1,
      "title": "Full Stack Developer",
      "salary_range": {
        "min": 80000,
        "max": 120000,
        "currency": "USD"
      },
      "specialization": "full_stack",
      "skills": ["react", "laravel", "nodejs", "mysql"],
      "job_type": "full_time",
      "location": "Remote"
    },
    "candidates": [
      {
        "id": 101,
        "name": "Alice Johnson",
        "specialization": "full_stack",
        "skills": ["react", "laravel", "mysql", "docker"],
        "job_preferred_type": "remote",
        "expected_salary": 95000,
        "location": "Remote"
      },
      {
        "id": 102,
        "name": "Bob Smith",
        "specialization": "frontend",
        "skills": ["react", "vue", "tailwind"],
        "job_preferred_type": "full_time",
        "expected_salary": 70000,
        "location": "Onsite - New York"
      },
      {
        "id": 103,
        "name": "Charlie Kim",
        "specialization": "backend",
        "skills": ["php", "laravel", "nodejs", "mongodb"],
        "job_preferred_type": "remote",
        "expected_salary": 85000,
        "location": "Remote"
      },
      {
        "id": 104,
        "name": "Diana Lopez",
        "specialization": "full_stack",
        "skills": ["vue", "nuxt", "laravel", "mysql"],
        "job_preferred_type": "part_time",
        "expected_salary": 60000,
        "location": "Remote"
      },
      {
        "id": 105,
        "name": "Ethan Brown",
        "specialization": "full_stack",
        "skills": ["react", "nodejs", "graphql", "aws"],
        "job_preferred_type": "remote",
        "expected_salary": 115000,
        "location": "Remote"
      }
    ]
  };



// All possible skills in the dataset
const allSkills = [
  'react', 'laravel', 'nodejs', 'mysql', 'docker', 'vue', 'tailwind',
  'php', 'mongodb', 'nuxt', 'graphql', 'aws'
];

// All possible specializations
const allSpecializations = ['full_stack', 'frontend', 'backend'];

// Function to create a binary skill vector
function getSkillVector(skills) {
  return allSkills.map(skill => skills.includes(skill) ? 1 : 0);
}

// Function to create a one-hot specialization vector
function getSpecializationVector(specialization) {
  return allSpecializations.map(spec => spec === specialization ? 1 : 0);
}

// Function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}



// Function to calculate candidate score
function calculateCandidateScore(job, candidate) {
    // Skill vector similarity (50% weight)
    const jobSkillVector = getSkillVector(job.skills);
    const candidateSkillVector = getSkillVector(candidate.skills);
    const skillSimilarity = cosineSimilarity(jobSkillVector, candidateSkillVector);
    const skillScore = skillSimilarity * 50;
  
    // Specialization vector similarity (20% weight)
    const jobSpecVector = getSpecializationVector(job.specialization);
    const candidateSpecVector = getSpecializationVector(candidate.specialization);
    const specSimilarity = cosineSimilarity(jobSpecVector, candidateSpecVector);
    const specScore = specSimilarity * 20;
  
    // Job type match (15% weight)
    const jobTypeScore = (candidate.job_preferred_type === job.job_type || candidate.job_preferred_type === 'remote') ? 15 : 0;
  
    // Salary fit (10% weight)
    const salaryScore = (candidate.expected_salary >= job.salary_range.min && candidate.expected_salary <= job.salary_range.max) ? 10 : 0;
  
    // Location match (5% weight)
    const locationScore = (candidate.location === job.location || job.location === 'Remote') ? 5 : 0;
  
    const totalScore = skillScore + specScore + jobTypeScore + salaryScore + locationScore;
  
    return {
      ...candidate,
      score: Math.round(totalScore * 100) / 100,
      skillSimilarity: Math.round(skillSimilarity * 100) / 100,
      specSimilarity: Math.round(specSimilarity * 100) / 100
    };
  }


  // Function to rank candidates
function rankCandidates(job, candidates) {
    return candidates
      .map(candidate => calculateCandidateScore(job, candidate))
      .sort((a, b) => b.score - a.score);
  }


  // Function to generate reasoning using Groq SDK
async function generateReasoning(rankedCandidates, job) {
    const prompt = `
      You are a hiring manager analyzing candidates for a job titled "${job.title}" with the following requirements:
      - Specialization: ${job.specialization}
      - Skills: ${job.skills.join(', ')}
      - Job Type: ${job.job_type}
      - Location: ${job.location}
      - Salary Range: ${job.salary_range.min} - ${job.salary_range.max} ${job.salary_range.currency}
  
      Candidates were ranked using vector-based similarity for skills and specialization (using cosine similarity) combined with checks for job type, salary, and location. Below is the ranked list with scores and similarity details:
      ${rankedCandidates.map(c => `
        - Name: ${c.name}, ID: ${c.id}
          Score: ${c.score}
          Skill Similarity: ${c.skillSimilarity} (based on skills: ${c.skills.join(', ')})
          Specialization Similarity: ${c.specSimilarity} (specialization: ${c.specialization})
          Preferred Job Type: ${c.job_preferred_type}
          Expected Salary: ${c.expected_salary} ${job.salary_range.currency}
          Location: ${c.location}
      `).join('\n')}
  
      Provide a detailed explanation of why the candidates were ranked in this order, emphasizing the vector-based similarity for skills and specialization, and how job type, salary, and location contributed. Structure the response as a summary followed by individual candidate analysis. Be concise but clear.
    `;
  
    try {
      const chatCompletion = await client.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a precise and professional hiring manager with expertise in vector-based matching.' },
          { role: 'user', content: prompt },
        ],
        model: 'llama3-70b-8192',
        temperature: 0.7,
        max_tokens: 1500,
      });
      return chatCompletion.choices[0].message.content;
    } catch (err) {
      if (err instanceof Groq.APIError) {
        console.error(`API Error: ${err.status} - ${err.name}`);
        return 'Error generating reasoning. Please ensure your API key is valid and try again.';
      }
      throw err;
    }
  }
  
  // Main function to match candidates and generate reasoning
  async function matchCandidates() {
    const rankedCandidates = rankCandidates(data.job, data.candidates);
    console.log('Ranked Candidates:');
    rankedCandidates.forEach(c => {
      console.log(`${c.name} (ID: ${c.id}) - Score: ${c.score}, Skill Similarity: ${c.skillSimilarity}, Specialization Similarity: ${c.specSimilarity}`);
    });
  
    const reasoning = await generateReasoning(rankedCandidates, data.job);
    console.log('\nReasoning:\n', reasoning);
  
    return { rankedCandidates, reasoning };
  }



  // Execute the matching system
matchCandidates().catch(err => console.error('Error:', err));