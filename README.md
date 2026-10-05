# GrowHigh
 
GrowHigh is a smart web-based platform for diploma students to prepare for ECET, build job-ready skills, explore careers, and find relevant internships and jobs in one place.
 
**Status:** In development | **Deadline:** 24 Oct 2026
 
## Users and roles
 
| Role | What they do |
|---|---|
| **Diploma Student** (main user) | Prepares for ECET, takes daily, weekly and cumulative tests, practices previous papers, tracks marks and weak areas, prepares for jobs and careers |
| **Faculty** | Adds ECET questions, creates daily, weekly and cumulative tests, assigns tests to students, views student marks and performance, identifies weak topics |
| **Admin** | Manages students and faculty, branches, subjects and topics, system content, jobs and internships, and monitors the platform |
| **Recruiter / Company** (optional) | Posts internships and entry-level jobs, views suitable student profiles as permitted |
 
## Main features
 
1. **Prepare for ECET:** practice questions, previous papers, daily tests, weekly tests, cumulative tests, progress tracking.
2. **Prepare for Jobs:** aptitude, coding, technical and HR interview practice; resume and project improvement.
3. **Explore Careers:** current and emerging technologies, career paths, required skills, learning roadmaps.
4. **Improve Communication:** English, speaking, group discussion, presentations, interview communication.
5. **Find Opportunities:** internships and entry-level jobs matched to skills and interests.
## ECET test structure
 
| Test | Flow |
|---|---|
| **Daily Test** | Faculty creates, students take, automatic evaluation, student sees result |
| **Weekly Test** | Faculty creates (covers that week's topics), students take, result and performance analysis |
| **Cumulative Test** | Faculty creates (covers multiple completed topics or chapters), students take, result and overall progress |
 
Weekly and cumulative tests are created by faculty, not generated automatically.
 
## Tech stack
 
| Layer | Choice |
|---|---|
| Backend | Django + Django REST Framework |
| Database | PostgreSQL |
| Frontend | React (Create React App) |
| Styling | Bootstrap / CSS |
| Version control | Git + GitHub |
| AI | To be added later as a supporting feature |
 
## Scope for the 24 Oct deadline
 
**Must have (build first)**
- Login and registration with roles: Student, Faculty, Admin
- Faculty adds questions and creates daily, weekly and cumulative tests
- Students take tests, with automatic marking and results
- Student marks and weak-topic view
- Admin manages users, branches, subjects and topics
**Should have**
- Previous papers and question bank practice
- Career explorer (technologies, roadmaps)
- Jobs and internships listing (posted by Admin)
**Later / if time allows**
- Recruiter role and posting
- Communication practice module
- Job interview practice (aptitude, coding, HR)
- Resume improvement
- AI features
## Links
 
- Project tracker: Google Sheets (GrowHigh Project Tracker)
 
## Git workflow

- `main` holds stable, working code only.
- `dev` is the branch for daily work. Changes are merged into `main` when they are tested.
- Commit messages are short and say what changed, for example: `add login page`, `fix test result calculation`.
- Commit small and often, at least once per working session.
