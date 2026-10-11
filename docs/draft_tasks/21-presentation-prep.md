# Task: Presentation Preparation

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-01
- **Status:** IN PROGRESS
- **Assignee:** Kassim10
- **Tags:** presentation, demo, required, gate:5-delivery
- **Dependencies:** 19-testing.md, 09-playwright-e2e-testing.md, 20-documentation.md
- **GitHub Issue:** #31 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/31)
- **Estimated Effort:** 6h

## Requirements

- 10 min presentation per group (including tech issues)
- Demonstrate working flow in frontend
- Project must be running before presentation

## User Stories

- As a presenter, I want a timed demo script so that the required flow fits within ten minutes including technical issues.
- As an examiner, I want to hear four concrete challenges and solutions so that the team can understand the engineering decisions.
- Discuss 4 challenges and how they were solved (1 per person)
- Practice presentation beforehand

## Design

### Presentation Structure (10 min)

```
1. Introduction (1 min)
   - Project overview
   - Team introduction

2. Live Demo (5 min)
   - Login as different roles
   - Patient search
   - View medical records
   - Create notes with visibility
   - Show access logs on blockchain
   - Real-time updates between servers

3. Technical Challenges (3 min)
   - Challenge 1: [Team member 1]
   - Challenge 2: [Team member 2]
   - Challenge 3: [Team member 3]
   - Challenge 4: [Team member 4]

4. Q&A (1 min)
```

### Demo Script

```
Demo Flow:
1. Start both servers (port 3001, 3002)
2. Open browser - Server 1
3. Login as Doctor
4. Search for patient "Anna Andersson"
5. View patient records
6. Create a note with "Healthcare" visibility
7. Open second browser - Server 2
8. Login as Nurse
9. View same patient
10. Show note appears in real-time
11. Login as Patient
12. Show patient can only see own data
13. Show access logs
14. Login as Unauthorized
15. Show "Access Denied" page
16. Show blockchain verification
```

### Challenge Examples

```
Potential Challenges to Discuss:
├── Blockchain integration with SQL database
├── Real-time synchronization between servers
├── Role-based access control implementation
├── GDPR compliance while maintaining functionality
├── P2P network communication
├── Handling Polish characters in search
├── WebSocket connection management
└── Database migration and seed data
```

## Tasks

- [ ] Create presentation outline
- [ ] Assign challenge topics to team members
- [ ] Practice demo flow (multiple times)
- [ ] Prepare backup plan for tech issues
- [ ] Create slides (if needed)
- [ ] Test demo on presentation computer
- [ ] Prepare for Q&A questions
- [ ] Time the presentation
- [ ] Do final run-through day before

## Done Criteria

- [ ] Presentation outline is complete
- [ ] All 4 challenges are assigned
- [ ] Demo flow works smoothly
- [ ] Presentation fits in 10 minutes
- [ ] Backup plan is ready
- [ ] Slides are ready (if using)
- [ ] Demo tested on target computer
- [ ] Team has practiced together
- [ ] All team members know their parts
- [ ] Final run-through completed

## Notes

- Start demo servers before presentation begins
- Have a backup plan if live demo fails (screenshots/video)
- Practice transitions between presenters
- Keep technical details concise
- Focus on what was learned, not just what was built

## Questions to Resolve

- [ ] Will we use slides or just live demo?
- [ ] Who presents which part?
- [ ] What's the backup if demo fails?
- [ ] How to handle unexpected questions?
