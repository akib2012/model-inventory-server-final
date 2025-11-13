# AI Inventory Project

Backend server for **AI Model Inventory Manager** built with **Node.js**, **Express**, **MongoDB**, and **Firebase Auth**.

---

## Features
- User authentication with Firebase
- CRUD for AI models
- Recent models & search
- Purchase tracking
- Filter models by framework
- Secure routes with token authorization

---

## Tech Stack
Node.js | Express.js | MongoDB | Firebase Admin SDK | Cors | dotenv

---
API Endpoints

Models

GET /models → All models

GET /recent-model → 6 recent

GET /models/:id → Model by ID

POST /models → Add model

PATCH /models/:id → Update model

DELETE /models/:id → Delete model

Purchase

POST /my-Purchase → Add purchase

GET /my-Purchase?email=<email> → User purchases

POST /my-Purchase/:id → Add & increment purchased count

Users

POST /users → Add user

Search & Filter

GET /search?search=<text> → Search models

GET /findmodels?framework=<framework> → Filter models


## Future Scope
- Implement **role-based authentication** for admins and regular users  
- Add **payment gateway integration** for model purchases  
- Develop a **frontend dashboard** for real-time model management  
- Enable **analytics and reporting** for purchased models  
- Add **notifications and email alerts** for new models or updates  
- Integrate **AI-based recommendations** for users based on their purchase history  
- Optimize for **performance and scalability** for large datasets

This backend server provides a complete solution to manage AI models, handle user authentication, track purchases, and filter/search models efficiently. It is built with scalability and security in mind, making it easy to extend for future features.




## Author
**Akib Bhuiyan**


