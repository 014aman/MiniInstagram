const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
// upload files
const multer = require("multer");
// environment varibale
const dotenv = require("dotenv");
dotenv.config(); // Load environment variables from .env file

app.set("view engine", "ejs");
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// const multer = require('multer');

const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + "-" + file.originalname;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

const mongoose = require("mongoose");

// connection
const schema = mongoose.Schema;

const photoSchema = new schema({
  caption: String,
  filename: String,
  uploadDate: { type: Date, default: Date.now },
});
const userSchema = new schema({
  name: String,
  username: String,
  password: String,
  photos: {
    type: [photoSchema],
    default: [],
  },
});

const userData = mongoose.model("userData", userSchema);
const photoModel = mongoose.model("photoModel", photoSchema);

// Route for user signup
app.get("/signup", (req, res) => {
  res.render("signUpPage", { msg: "", user: "", page: "signup" });
});
app.post("/signup", async (req, res) => {
  const { username, password, name } = req.body;

  try {
    // Check if the username already exists

    const existingUser = await userData.findOne({ username });
    if (existingUser) {
      return res.render("signUpPage", {
        msg: "User Already Exist",
        user: "",
        page: "signup",
      });
    }
    // Create a new user
    else {
      const newUser = new userData({ name, username, password });
      await newUser.save();

      res.redirect("/login");
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  //   console.log();
  try {
    // Find the user in the database
    const user = await userData.findOne({ username });
    console.log(user);
    if (!user || user.password !== password) {
      return res.render("loginPage", {
        user: "",
        msg: "Invalid Credentials.",
        page: "login",
      });
    }
    // Create a JWT token
    const token = jwt.sign(
      { username: user.username, _id: user._id },
      process.env.secretKey
    );
    // Set the token as an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    // Send a response to the client
    res.redirect("/");
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.cookies.authToken;
  //   console.log(token);
  if (!token) {
    return res.redirect("/login");
  }

  jwt.verify(token, process.env.secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = decoded;
    next();
  });
};

// Homepage
app.get("/", verifyToken, async (req, res) => {
  const thisUser = await userData.findById(req.user._id);
  res.render("homePage", { user: thisUser, page: "userPage" });
});
// login request
app.get("/login", function (req, res) {
  res.render("loginPage", { user: "", msg: "", page: "login" });
});
// Uploading photo
app.get("/uploadPhoto", verifyToken, (req, res) => {
  res.render("uploadPhoto", { user: req.user, page: "uploadPhoto" });
});
app.post(
  "/uploadPhoto",
  verifyToken,
  upload.single("imageUpload"),
  async (req, res) => {
    try {
      // Process form data and uploaded video
      const { caption } = req.body;

      const filename = req.file.filename;
      console.log("User ID:", req.user);
      const photoAlbum = await userData.findById(req.user._id);
      //   console.log(photoAlbum);
      // Create a new video object with the received data
      const newPhoto = new photoModel({
        caption,
        filename,
        uploadDate: Date.now(),
      });

      // Push the new video into the videos array of the course
      photoAlbum.photos.push(newPhoto);

      // Save the tutorDB
      await photoAlbum.save();

      // Redirect to the video library or display a success message
      console.log("Uploaded the photo");
      res.redirect("/");
    } catch (error) {
      console.error("Error uploading video:", error);
      // Handle the error and display an error message
      res.status(500).json({ error: "Error uploading video" });
    }
  }
);
// Route for user logout
app.get("/logout", (req, res) => {
  // Clear the authentication token cookie
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });

  res.redirect("/login");
});

// Start the server
async function start() {
  await mongoose
    .connect(process.env.mongodb)
    .then(console.log("Database Connected"));
  app.listen(process.env.PORT, () => {
    console.log(`Server is running on ${process.env.PORT}`);
  });
}
start();
