import { MongoClient } from "./src/client.ts";
import { assert, assertEquals } from "./test.deps.ts";
interface IUser {
  username: string;
  password: string;
  _id: { $oid: string };
  date?: Date;
}
const { test } = Deno;
const dateNow = Date.now();
const hostName = "localhost";

async function testWithClient(
  name: string,
  fn: (client: MongoClient) => void | Promise<void>,
) {
  test(name, async () => {
    const client = await getClient();
    await fn(client);
    client.close();
  });
}

async function getClient(): Promise<MongoClient> {
  const client = new MongoClient();
  await client.connect(`mongodb://${hostName}:27017`);
  return client;
}

test("testConnectWithUri", async () => {
  const client = new MongoClient();
  await client.connect(`mongodb://${hostName}:27017`);
  const names = await client.listDatabases();
  assert(names instanceof Array);
  assert(names.length > 0);
  client.close();
});

test("testConnectWithOptions", async () => {
  const client = new MongoClient();
  await client.connect({
    servers: [{ host: hostName, port: 27017 }],
  });
  const names = await client.listDatabases();
  assert(names instanceof Array);
  assert(names.length > 0);
  client.close();
});

await testWithClient("testListCollectionNames", async (client) => {
  const db = client.database("local");
  const names = await db.listCollectionNames();
  assertEquals(names, ["startup_log"]);
});

await testWithClient("testInsertOne", async (client) => {
  const db = client.database("test");
  const users = db.collection<IUser>("mongo_test_users");
  const insertId = await users.insertOne({
    username: "user1",
    password: "pass1",
    date: new Date(dateNow),
  });

  assertEquals(insertId.toString().length, 24);

  const user1 = await users.findOne({
    _id: insertId,
  });

  assertEquals(user1, {
    _id: insertId,
    username: "user1",
    password: "pass1",
    date: new Date(dateNow),
  });
});

// test("testUpsertOne", async () => {
//   const db = client.database("test");
//   const users = db.collection<IUser>("mongo_test_users");
//   const { upsertedId } = await users.updateOne(
//     {
//       _id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
//     },
//     {
//       username: "user1",
//       password: "pass1",
//       date: new Date(dateNow),
//     },
//     { upsert: true },
//   );

//   assert(upsertedId);
//   assertEquals(Object.keys(upsertedId), ["$oid"]);

//   const user1 = await users.findOne({
//     _id: ObjectId(upsertedId.$oid),
//   });

//   assertEquals(user1, {
//     _id: upsertedId,
//     username: "user1",
//     password: "pass1",
//     date: new Date(dateNow),
//   });
// });

// testWithClient("testInsertOneTwice", async (client) => {
//   const db = client.database("test");
//   const users = db.collection<IUser>("mongo_test_users_2");
//   await users.insertOne({
//     _id: ("aaaaaaaaaaaaaaaaaaaaaaaa"),
//     username: "user1",
//   });

//   await assertThrowsAsync(
//     () =>
//       users.insertOne({
//         _id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
//         username: "user1",
//       }) as any,
//     undefined,
//     "E11000",
//   );
// });

await testWithClient("testFindOne", async (client) => {
  const db = client.database("test");
  const users = db.collection<IUser>("mongo_test_users");
  const user1 = await users.findOne();
  assertEquals(Object.keys(user1!), ["_id", "username", "password", "date"]);

  const query = { test: 1 };
  const findNull = await users.findOne(query);
  assertEquals(findNull, undefined);
  const projectionUser = await users.findOne(
    {},
    { projection: { _id: 0, username: 1 } },
  );
  assertEquals(Object.keys(projectionUser!), ["username"]);
  const projectionUserWithId = await users.findOne(
    {},
    { projection: { username: 1 } },
  );
  assertEquals(Object.keys(projectionUserWithId!), ["_id", "username"]);
});
await testWithClient("testFind", async (client) => {
  const db = client.database("test");
  const users = db.collection<IUser>("mongo_test_users");
  const user = await users.find();
  assertEquals(user!.length > 0, true);
});
testWithClient("testUpdateOne", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const result = await users.updateOne({}, { username: "USER1" });
  assertEquals(result, { matchedCount: 1, modifiedCount: 1, upsertedId: null });
});
testWithClient("testUpdateOneWithUpsert", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const result = await users.updateOne(
    { username: "user2" },
    { username: "USER2" },
    { upsert: true },
  );
  assertEquals(result.matchedCount, 0);
  assertEquals(result.modifiedCount, 1);
  assertEquals(result.upsertedCount, 1);
});

testWithClient("testDeleteOne", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const deleteCount = await users.deleteOne({});
  assertEquals(deleteCount, 1);
});

testWithClient("testInsertMany", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const { insertedCount, insertedIds } = await users.insertMany([
    {
      username: "many",
      password: "pass1",
    },
    {
      username: "many",
      password: "pass2",
    },
  ]);

  assertEquals(insertedCount, 2);
  assertEquals(insertedIds.length, 2);
});

testWithClient("testFindOr", async (client) => {
  const db = client.database("test");
  const users = db.collection<IUser>("mongo_test_users");
  const user1 = await users.find({
    $or: [
      {
        password: "pass1",
      },
      {
        password: "pass2",
      },
    ],
  });

  assert(user1 instanceof Array);
  assertEquals(user1.length, 2);
});

testWithClient("testFind", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const findUsers = await users.find(
    { username: "many" },
    { skip: 1, limit: 1 },
  );
  assert(findUsers instanceof Array);
  assertEquals(findUsers.length, 1);

  const notFound = await users.find({ test: 1 });
  assertEquals(notFound, []);
});

testWithClient("testCount", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const count = await users.count({ username: "many" });
  assertEquals(count, 2);
});

// testWithClient("testAggregation", async (client) => {
//   const db = client.database("test");
//   const users = db.collection("mongo_test_users");
//   const docs = await users.aggregate([
//     { $match: { username: "many" } },
//     { $group: { _id: "$username", total: { $sum: 1 } } },
//   ]);
//   assertEquals(docs, [{ _id: "many", total: 2 }]);
// });

testWithClient("testUpdateMany", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  const result = await users.updateMany(
    { username: "many" },
    { $set: { username: "MANY" } },
  );
  assertEquals(result, { matchedCount: 2, modifiedCount: 2, upsertedId: null });
});

testWithClient("testDeleteMany", async (client) => {
  const db = client.database("test");
  const users = db.collection("mongo_test_users");
  // const deleteCount = await users.deleteMany({ username: "many" });
  const deleteCount = await users.deleteMany({ username: "MANY" });
  assertEquals(deleteCount, 2);
});

// testWithClient("testDistinct", async (client) => {
//   const db = client.database("test");
//   const users = db.collection<IUser>("mongo_test_users");
//   const user1 = await users.distinct("username");
//   assertEquals(user1, ["user1"]);
// });

// // TODO mongdb_rust official library has not implemented this feature
// // testWithClient("testCreateIndexes", async (client) => {
// //   const db = client.database("test");
// //   const collection = db.collection("mongo_indexes");
// //   const result = await collection.createIndexes([
// //     { keys: { created_at: 1 }, options: { expireAfterSeconds: 10000 } }
// //   ]);
// //   console.log(result);
// // });

// testWithClient("testDropConnection", async ()client => {
//   const db = client.database("test");
//   db.collection("mongo_test_users_2").drop();
//   db.collection("mongo_test_users").drop();
//   // assertEquals(result, { success: true });
// });
