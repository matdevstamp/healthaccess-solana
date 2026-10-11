# Inl 3 – Group Assignment

## Contents

- [Information](#information)
- [Task Description](#task-description)
- [To Do](#to-do)
- [Requirements List](#requirements-list)
- [Presentation](#presentation)
- [Example of Responsibility Distribution & Schedule (not a requirement)](#example-of-responsibility-distribution--schedule-not-a-requirement)
- [Resources](#resources)
- [Assessment Examples](#assessment-examples)
  - [For IG](#for-ig)
  - [For G](#for-g)

## Information

- **Grading scale:** IG/G
- **Deadline:** Friday 2 October 2026 at 11:00
- **Learning objectives from the syllabus being examined:**
  1. (4) Develop complete blockchain-driven programming from scratch
  2. (8) Apply and connect previous knowledge and skills in frontend and blockchain in a Node.js project
- **Submission:**
  1. Commit _and push_ the code to the repository on GitHub. Verify that what you have on your computer also shows on GitHub.
  2. Make sure the repository is public and/or invite the user `postmodernistx` as a "collaborator" to the repository.
  3. Paste the link to the repository on itslearning in the submission box, and zip & upload the code (you are very welcome to exclude the `node_modules` folder)

## Task Description

The GDPR law requires that patients have the right to know who has looked at their (medical) records. Curious staff sometimes peek at, for example, famous people's or relatives' patient data, or delete server logs to hide unauthorised access.

You are to create a system where the actual medical data is stored in a SQL database, but every time a doctor, nurse, the patient themselves or anyone else looks at the data, an "access log" is generated to the blockchain.

## To Do

The project must include:

- A front end/UI in a framework of your choice (not only HTML)
- 1 login page (you choose the login method yourselves)
- 5 user roles:
  1. doctor
  2. nurse/ambulance staff
  3. a primary care centre
  4. the patient themselves
  5. an "unauthorised" person
- 1 patient view, which varies depending on the logged-in role
- Associated backend, databases and routing

**Example flow – doctor/nurse/ambulance staff**

- The person logs in and should then see a search box where they can search for the patient's name.
- Once they have selected a patient, the record should appear, and "access logs" should also be displayed.
- The person should be able to add a note and save it, and choose who it should be visible to from the following options:
  - Only themselves/the logged-in user (private note)
  - Only healthcare staff (doctor, nurse, ambulance staff)
  - Everyone (i.e. the above plus the patient)

**Example flow – patient**

- The person logs in and should then be directed straight to their record page with all data
- The person should not be able to manipulate the URL to bring up someone else's data
- The patient should be able to see "access logs"
- The patient should only see notes that fall into the "everyone" category, i.e. not the doctor's private notes. However, access should be visible.

**Example flow – unauthorised**

- It goes without saying that only an "Access denied" page should be shown.

In addition, you must include a P2P network:

- You must have at least 2 simultaneous servers running, e.g. one on port 3001 and one on port 3002. The purpose is to simulate, for example, Hospital S and Ambulance A and their simultaneous access to the system.
- If a person logged in on server 1 writes a medical note, that access log should be distributed out into the blockchain.
- If a person is simultaneously logged in on server 2 and has permission to read the medical note, it should appear in the "note list" (use sockets/broadcasting for this).

**Other:**

- If you want to implement a "passwordless login", that is fine, but it is not a requirement. If you are bored, you could try a passkey, if possible.
- Preferably work test-driven in this project too
- ⚠️ You must document at least 2 project meetings (e.g. daily standups) _per week_ in your repository. A note is enough, but it must be clear how you have driven the project forward and what remains (so that not all work is done at the last minute in the final week). Preferably use an agile way of working from the start.
- The project does not need to be live/online, but must work on your respective computers.

**Important:**

- Medical records must NEVER be stored on the blockchain, which is contrary to the GDPR.
- You _must_ write a group contract.

## Requirements List

- The group contract must be written before you start the project, see [template](https://gist.github.com/postmodernistx/6afcbe224bce912a6da1a86b8b94adbc). Check it into the repository as `gruppkontrakt.md`.
- A working flow/demo presented in class.
- README in the repository
- Agile way of working
- **Pull requests/code review:** you must work with PRs so that you actively take part in each other's code and ensure its quality. Nothing may be committed to `main` without going via a PR. You can set up rules for this in your repository if you are unsure about the workflow.

## 🖥️ Presentation

- 10 min per group incl. technical hiccups
- It is OK if one person presents; you divide the presentation among yourselves as you wish.
- Practise the presentation; set aside time for this in your project planning!
- In the presentation you must:
  - Demonstrate a working flow in the front end (make sure the project is running before it is your turn to present)
  - Talk about 4 challenges and how you solved them (e.g. 1 per person)

## Example of Responsibility Distribution & Schedule (not a requirement)

However, I would like to see you collaborate, pair-programme and share task areas so that you get a broad understanding of how a project works as a whole.

> **Status (Colosseum-hackathon).** The list below is the course's *example* of
> responsibility distribution, not a requirement. Here is what was actually built in the hackathon fork:
> signing and immutability were moved **on-chain** to an Anchor program
> (hash chain on an `AuditTrail` PDA). Merkle trees and "longest chain
> rule" fork handling were **never** built; they are marked below. See
> `docs/hackathon/INTERFACE-CONTRACT.md`.

**Person 1 – Crypto & ledger**

- Responsible for immutable audit logs and security
- The `Block` & `Blockchain` code classes.
- Implementation of public/private key signing. ✅ *Now: the program's authority signer on Solana.*
- Verification logic to ensure the hashes match the doctor's signature. ✅ *Now: `head = sha256(prev ‖ borsh(event))`, verified against the chain.*
- Merkle tree implementation for batching access logs. ❌ *Not built.*

**Person 2 – P2P Network**

- Responsible for synchronisation between multiple hospitals and network integrity
- WebSocket server/client communication between different hospitals
- Sync "audit blocks" between hospitals
- Solve "fork" problems with the "longest chain rule" if a hospital happens to go down/offline.

**Person 3 – Express API & middleware**

- Express routes for writing/reading data.
- `auditLogger` middleware: automatically intercepts database access, signs the event and extracts a block.
- Possible test coverage

**Person 4 – Front end**

- Search for and display the patient's record
- Login
- Live view of who has read/opened/written to the record
- Cryptographic "verification badge" if a log has been changed

## 📚 Resources

- [socket.io](https://socket.io/docs/v4/tutorial/introduction)
- [Group contract template](https://gist.github.com/postmodernistx/6afcbe224bce912a6da1a86b8b94adbc)
- [JavaScript-based passkey](https://simplewebauthn.dev/)

## Assessment Examples

### For IG

- The points in the requirements list are not met
- The project does not work

### For G

- The points in the requirements list/task description are met _and presented_
- The presentation has been carried out
- The README file must contain the following:
  - A description of the project
  - Screenshots of the finished project
  - Installation/getting-started instructions (preferably update them continuously during the project, as it makes things easier, e.g. once a week)
  - A description of the database structure and preferably a `CREATE` script so that the database can be recreated
  - Who has worked on it
  - You are welcome to use e.g. [README.so](https://readme.so/editor)
