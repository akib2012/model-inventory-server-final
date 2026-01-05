require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
if (process.env.FIREVASE_SERVICE_KEY) {
  const decoded = Buffer.from(
    process.env.FIREVASE_SERVICE_KEY,
    "base64"
  ).toString("utf-8");
  const serviceAccount = JSON.parse(decoded);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized.");
} else {
  console.log("FB_SERVICE_KEY not found in .env");
}

// JWT middleware
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).send({ message: "Unauthorized: No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized: Invalid token" });
  }
};

// MongoDB setup
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.exfto5h.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1 },
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("ai_model_inventory_manager");
    const modelscollections = db.collection("models");
    const userscollections = db.collection("users");

    // Root route
    app.get("/", (req, res) => res.send("AI Model Inventory Server Running"));

    // Get all models
    app.get("/models", async (req, res) => {
      const models = await modelscollections.find().toArray();
      res.send(models);
    });

    app.get("/dashboard-stats", verifyJWT, async (req, res) => {
      try {
        const totalModels = await modelscollections.countDocuments();
        const totalUsers = await userscollections.countDocuments();

        const allModels = await modelscollections.find().toArray();
        const totalDownloads = allModels.reduce(
          (sum, model) => sum + (model.dowloded_by?.length || 0),
          0
        );

        res.send({
          totalModels,
          totalUsers,
          totalDownloads,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to load dashboard stats" });
      }
    });

    app.get("/dashboard-models", verifyJWT, async (req, res) => {
      try {
        const models = await modelscollections
          .find({})
          .sort({ createdAt: -1 })
          .project({
            name: 1,
            framework: 1,
            createdAt: 1,
            dowloded_by: 1,
          })
          .toArray();

        const formatted = models.map((model) => ({
          _id: model._id,
          name: model.name,
          framework: model.framework,
          createdAt: model.createdAt,
          downloads: model.dowloded_by?.length || 0,
        }));

        res.send(formatted);
      } catch (error) {
        res.status(500).send({ message: "Failed to load dashboard models" });
      }
    });

    // Get recent models
    app.get("/recent-model", async (req, res) => {
      const models = await modelscollections
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(models);
    });

    // Get model by ID
    app.get("/models/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const model = await modelscollections.findOne({
          _id: new ObjectId(id),
        });
        if (!model) return res.status(404).send({ message: "Model not found" });
        res.send(model);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch model" });
      }
    });

    // Create new model
    app.post("/models", async (req, res) => {
      const newmodel = { ...req.body, dowloded_by: [] }; // initialize downloads
      const result = await modelscollections.insertOne(newmodel);
      res.send(result);
    });

    // Purchase model
    app.post("/my-Purchase/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.tokenEmail;

        const model = await modelscollections.findOne({
          _id: new ObjectId(id),
        });
        if (!model) return res.status(404).send({ message: "Model not found" });

        if (!model.dowloded_by) model.dowloded_by = [];

        if (model.dowloded_by.includes(email)) {
          return res.status(400).send({ message: "Already purchased" });
        }

        await modelscollections.updateOne(
          { _id: new ObjectId(id) },
          { $push: { dowloded_by: email } }
        );

        res.send({ message: "Model purchased successfully" });
      } catch (error) {
        res.status(500).send({ message: "Purchase failed" });
      }
    });

    // Get logged-in user's purchased models
    app.get("/my-Purchase", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;

        const models = await modelscollections
          .find({ dowloded_by: email })
          .toArray();

        res.send({
          count: models.length,
          models,
        });
      } catch (error) {
        console.error("Fetch purchases error:", error);
        res.status(500).send({ message: "Failed to fetch purchases" });
      }
    });
    app.get("/userPurchase", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;

        const models = await modelscollections
          .find({ dowloded_by: email })
          .toArray();

        res.send({
          count: models.length,
          models,
        });
      } catch (error) {
        console.error("Fetch purchases error:", error);
        res.status(500).send({ message: "Failed to fetch purchases" });
      }
    });

    // Update model (EDIT)
    app.patch("/models/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.tokenEmail;
        const updatedData = req.body;

        // Check valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid model ID" });
        }

        // Find model
        const existingModel = await modelscollections.findOne({
          _id: new ObjectId(id),
        });

        if (!existingModel) {
          return res.status(404).send({ message: "Model not found" });
        }

        // Authorization check (owner only)
        if (existingModel.createdBy !== email) {
          return res.status(403).send({ message: "Forbidden: Not your model" });
        }

        // Prevent changing owner & downloads
        delete updatedData.createdBy;
        delete updatedData.dowloded_by;
        delete updatedData._id;

        const result = await modelscollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...updatedData,
              updatedAt: new Date(),
            },
          }
        );

        res.send({
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ message: "Failed to update model" });
      }
    });

    // Delete model
    app.delete("/models/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await modelscollections.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({ deletedCount: result.deletedCount });
      } catch (error) {
        res.status(500).send({ message: "Delete failed" });
      }
    });

    // Get logged-in user's models
    app.get("/my-models", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;
        const models = await modelscollections
          .find({ createdBy: email })
          .toArray();
        res.send({ count: models.length, models });
      } catch (err) {
        res.status(500).send({ message: "Error fetching your models", err });
      }
    });

    // User registration
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existing = await userscollections.findOne({
        user_mail: user.user_mail,
      });
      if (existing) return res.send({ message: "user exists" });

      const result = await userscollections.insertOne(user);
      res.send(result);
    });

    // Get public profile by email
    app.get("/profile/:email", async (req, res) => {
      try {
        const email = decodeURIComponent(req.params.email).trim();
        const user = await userscollections.findOne(
          { user_mail: email },
          { projection: { user_name: 1, user_photo: 1, role: 1, _id: 0 } }
        );
        if (!user) return res.status(404).send({ message: "User not found" });
        res.send(user);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch profile" });
      }
    });

    // Find models with framework filter
    // Search + Filter models
    app.get("/findmodels", async (req, res) => {
      try {
        const { search, framework } = req.query;

        const andConditions = [];

        if (search) {
          andConditions.push({
            $or: [
              { name: { $regex: search, $options: "i" } },
              { framework: { $regex: search, $options: "i" } },
              { dataset: { $regex: search, $options: "i" } },
            ],
          });
        }

        if (framework) {
          andConditions.push({
            framework: { $in: framework.split(",") },
          });
        }

        const query = andConditions.length ? { $and: andConditions } : {};

        const result = await modelscollections.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch models" });
      }
    });

    console.log("Server connected to MongoDB");
  } finally {
    // keep client open
  }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Server listening on port ${port}`));
