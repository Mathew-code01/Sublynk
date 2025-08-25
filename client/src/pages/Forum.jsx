// client/src/pages/Forum.jsx
// client/src/pages/Forum.jsx
// client/src/pages/Forum.jsx
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "../styles/Forum.css";
import DashboardLayout from "../layouts/DashboardLayout";
import { fetchPosts, createPost, deletePost } from "../api/forumAPI";
import { useAuth } from "../context/AuthContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const socket = io("http://localhost:5000");

const Forum = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const textareaRef = useRef(null);
  const { user } = useAuth();

  const isLoggedIn = Boolean(user);
  const username = user?.username || "Guest";
  // const avatar = user?.avatar || "https://i.pravatar.cc/40?u=default";


  useEffect(() => {
    loadPosts();

    socket.on("newPost", (post) => {
      setPosts((prev) => [post, ...prev]);
    });

    socket.on("deletePost", (postId) => {
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    });

    return () => {
      socket.off("newPost");
      socket.off("deletePost");
    };
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await fetchPosts();
      setPosts(data.reverse());
    } catch (err) {
      setErrorMsg("Failed to load forum posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const el = document.querySelector(".forum-posts");
    if (el) el.scrollTop = el.scrollHeight;
  }, [posts]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handlePost = async () => {
    if (!isLoggedIn) return alert("You must log in to post.");
    if (!newPost.trim()) return;

    try {
      const cleanPost = newPost.trim();
      const post = await createPost(cleanPost, user.username, user.avatar);
      setNewPost("");
      socket.emit("newPost", post);
      setSuccessMsg("Post added!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err) {
      setErrorMsg("Failed to post. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePost(id);
      socket.emit("deletePost", id);
    } catch {
      alert("Failed to delete post.");
    }
  };

  return (
    <DashboardLayout>
      <div className="forum-page">
        <h2 className="forum-title">Community Forum</h2>

        {loading && <p className="forum-loading">Loading posts...</p>}
        {errorMsg && <p className="forum-error">{errorMsg}</p>}
        {successMsg && <p className="forum-success">{successMsg}</p>}

        {posts.length === 0 && !loading ? (
          <p className="no-posts">No posts yet. Start the conversation!</p>
        ) : (
          <ul className="forum-posts">
            {posts.map((post) => (
              <li
                key={post._id}
                className={`forum-post ${
                  username === post.username ? "self" : "other"
                }`}
              >
                <div className="post-header">
                  <img
                    src={post.avatar || "https://i.pravatar.cc/40?u=default"}
                    alt={`${post.username}'s avatar`}
                    className="post-avatar"
                  />

                  <div className="post-meta">
                    <strong>{post.username || "Anonymous"}</strong>
                    <small>{dayjs(post.createdAt).fromNow()}</small>
                  </div>
                </div>
                <p>{post.content}</p>
                {username === post.username && (
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(post._id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isLoggedIn ? (
          <div className="forum-input">
            <textarea
              ref={textareaRef}
              placeholder="Write something..."
              maxLength={300}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <div className="forum-actions">
              <span>{newPost.length}/300</span>
              <button
                className="forum-btn"
                onClick={handlePost}
                disabled={!newPost.trim()}
              >
                Post
              </button>
            </div>
          </div>
        ) : (
          <p className="login-warning">Please log in to join the discussion.</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Forum;
