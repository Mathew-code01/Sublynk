// client/src/pages/Forum.jsx
// client/src/pages/Forum.jsx
// client/src/pages/Forum.jsx
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "../styles/Forum.css";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  fetchPosts,
  createPost,
  deletePost,
  addComment,
  toggleLike,
} from "../api/forumAPI";
import { FiSend, FiTrash2, FiMessageCircle, FiHeart } from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../api/config";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "react-toastify";


dayjs.extend(relativeTime);

const Forum = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [replyInputs, setReplyInputs] = useState({}); // per post replies
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const postsEndRef = useRef(null);

  const { user } = useAuth();
  const isLoggedIn = Boolean(user);
  const username = user?.username || "Guest";

  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.on("newPost", (post) => {
      setPosts((prev) => [post, ...prev]);
    });

    socketRef.current.on("deletePost", (postId) => {
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    });

    socketRef.current.on("newComment", ({ postId, comment }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, comments: [comment, ...p.comments] } : p
        )
      );
    });

    socketRef.current.on("newReply", ({ postId, reply }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, replies: [...(p.replies || []), reply] }
            : p
        )
      );
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
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
    loadPosts();
  }, []);

  useEffect(() => {
    postsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts]);

  const handlePost = async () => {
    if (!isLoggedIn) return toast.warn("⚠️ Please log in to post.");
    if (!newPost.trim()) return;

    try {
      const post = await createPost(newPost.trim(), user.username, user.avatar);
      setNewPost("");
      socketRef.current.emit("newPost", post);
      toast.success("✅ Post added!");
    } catch {
      toast.error("❌ Failed to post.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePost(id);
      socketRef.current.emit("deletePost", id);
      toast.info("🗑️ Post deleted.");
    } catch {
      toast.error("❌ Failed to delete post.");
    }
  };

  const handleLike = async (postId) => {
    if (!isLoggedIn) return toast.warn("⚠️ Please log in to like.");
    try {
      const updatedPost = await toggleLike(postId);
      setPosts((prev) => prev.map((p) => (p._id === postId ? updatedPost : p)));
    } catch {
      toast.error("❌ Failed to like post.");
    }
  };

  const handleReply = async (postId) => {
    if (!isLoggedIn) return toast.warn("⚠️ Please log in to reply.");
    const replyText = replyInputs[postId]?.trim();
    if (!replyText) return;

    try {
      const updatedPost = await addComment(postId, replyText);
      setPosts((prev) => prev.map((p) => (p._id === postId ? updatedPost : p)));

      setReplyInputs((prev) => ({ ...prev, [postId]: "" }));
      socketRef.current.emit("newComment", {
        postId,
        comment: updatedPost.comments[0], // latest one
      });
      toast.success("💬 Reply added!");
    } catch {
      toast.error("❌ Failed to reply.");
    }
  };

  return (
    <DashboardLayout>
      <div className="forum-page">
        <h2 className="forum-title">Community Forum</h2>

        {loading && <p className="forum-loading">Loading posts...</p>}
        {errorMsg && <p className="forum-error">{errorMsg}</p>}

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

                <div className="post-actions">
                  {isLoggedIn && (
                    <button
                      className="like-btn"
                      onClick={() => handleLike(post._id)}
                    >
                      <FiHeart
                        color={post.likes?.includes(user?._id) ? "red" : "gray"}
                      />{" "}
                      {post.likes?.length || 0}
                    </button>
                  )}
                  {isLoggedIn && (
                    <button
                      className="reply-btn"
                      onClick={() =>
                        setReplyInputs((prev) => ({
                          ...prev,
                          [post._id]: prev[post._id] || "",
                        }))
                      }
                    >
                      <FiMessageCircle /> Reply
                    </button>
                  )}
                  {username === post.username && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(post._id)}
                      title="Delete post"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>

                {/* Comments */}
                {post.comments?.length > 0 && (
                  <ul className="replies">
                    {post.comments.map((c) => (
                      <li key={c._id} className="reply">
                        <img
                          src={c.avatar || "https://i.pravatar.cc/30?u=default"}
                          alt="reply avatar"
                          className="reply-avatar"
                        />
                        <div className="reply-content">
                          <strong>{c.username}</strong>{" "}
                          <small>{dayjs(c.createdAt).fromNow()}</small>
                          <p>{c.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Replies */}
                {post.replies?.length > 0 && (
                  <ul className="replies">
                    {post.replies.map((reply) => (
                      <li key={reply._id} className="reply">
                        <img
                          src={
                            reply.avatar || "https://i.pravatar.cc/30?u=default"
                          }
                          alt="reply avatar"
                          className="reply-avatar"
                        />
                        <div className="reply-content">
                          <strong>{reply.username}</strong>{" "}
                          <small>{dayjs(reply.createdAt).fromNow()}</small>
                          <p>{reply.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Reply Input */}
                {replyInputs[post._id] !== undefined && (
                  <div className="reply-input">
                    <textarea
                      placeholder="Write a reply..."
                      maxLength={200}
                      value={replyInputs[post._id]}
                      onChange={(e) =>
                        setReplyInputs((prev) => ({
                          ...prev,
                          [post._id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="reply-send-btn"
                      onClick={() => handleReply(post._id)}
                      disabled={!replyInputs[post._id]?.trim()}
                    >
                      <FiSend /> Reply
                    </button>
                  </div>
                )}
              </li>
            ))}
            <div ref={postsEndRef} />
          </ul>
        )}

        {isLoggedIn ? (
          <div className="forum-input">
            <textarea
              placeholder="Write something..."
              maxLength={300}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <div className="forum-actions">
              <span
                className={`char-count ${
                  newPost.length > 250 ? "near-limit" : ""
                }`}
              >
                {newPost.length}/300
              </span>
              <button
                className="forum-btn"
                onClick={handlePost}
                disabled={!newPost.trim()}
              >
                <FiSend /> Post
              </button>
            </div>
          </div>
        ) : (
          <p className="login-warning">
            🔑 Please log in to join the discussion.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Forum;
