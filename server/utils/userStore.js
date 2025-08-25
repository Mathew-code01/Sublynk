// server/utils/userStore.js
const fs = require("fs-extra");
const path = require("path");
const { userStorePath } = require("../config/authConfig");

const ABS_PATH = path.resolve(userStorePath);

async function ensureStore() {
  await fs.ensureFile(ABS_PATH);
  const txt = await fs.readFile(ABS_PATH, "utf8").catch(() => "");
  if (!txt.trim()) {
    await fs.writeJson(ABS_PATH, { users: [] }, { spaces: 2 });
  }
}

async function readUsers() {
  await ensureStore();
  const data = await fs.readJson(ABS_PATH).catch(() => ({ users: [] }));
  return Array.isArray(data.users) ? data.users : [];
}

async function writeUsers(users) {
  await fs.writeJson(ABS_PATH, { users }, { spaces: 2 });
}

async function findUserByEmail(email) {
  const users = await readUsers();
  return (
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
  );
}

async function findUserById(id) {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

async function createUser(userObj) {
  const users = await readUsers();
  users.push(userObj);
  await writeUsers(users);
  return userObj;
}

async function updateUser(userObj) {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === userObj.id);
  if (idx >= 0) {
    users[idx] = userObj;
    await writeUsers(users);
    return userObj;
  }
  return null;
}

module.exports = {
  readUsers,
  writeUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
};
