// server/controllers/forumController.js
// server/controllers/forumController.js
// server/controllers/forumController.js
const ForumPost = require("../models/ForumPost");

// GET all
exports.getPosts = async (req, res) => {
  const posts = await ForumPost.find().sort({ createdAt: -1 });
  res.json(posts);
};

// CREATE post
exports.createPost = async (req, res) => {
  const { content, imageUrl } = req.body;
  const post = await ForumPost.create({
    user: req.user._id,
    username: req.user.name,
    content,
    imageUrl,
  });
  res.status(201).json(post);
};

// DELETE post
exports.deletePost = async (req, res) => {
  const post = await ForumPost.findById(req.params.id);
  if (!post || post.user.toString() !== req.user._id.toString()) {
    return res.status(401).json({ message: "Not authorized" });
  }
  await post.remove();
  res.sendStatus(200);
};

// LIKE post
exports.toggleLike = async (req, res) => {
  const post = await ForumPost.findById(req.params.id);
  const userId = req.user._id;

  if (!post) return res.status(404).send("Post not found");

  const alreadyLiked = post.likes.includes(userId);
  if (alreadyLiked) {
    post.likes.pull(userId);
  } else {
    post.likes.push(userId);
  }

  await post.save();
  res.json(post);
};

// ADD comment
exports.addComment = async (req, res) => {
  const post = await ForumPost.findById(req.params.id);
  if (!post) return res.status(404).send("Post not found");

  const comment = {
    user: req.user._id,
    username: req.user.username,
    content: req.body.content,
  };

  post.comments.unshift(comment);
  await post.save();
  res.json(post);
};
