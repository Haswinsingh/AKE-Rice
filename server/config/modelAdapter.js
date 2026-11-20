const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const SEED_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = isVercel ? '/tmp/ake_data' : SEED_DIR;

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Pre-populate /tmp from bundled seed files on serverless
    if (isVercel && fs.existsSync(SEED_DIR)) {
      const files = fs.readdirSync(SEED_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.copyFileSync(path.join(SEED_DIR, file), path.join(DATA_DIR, file));
        }
      }
    }
  } catch (e) {
    console.warn('[DataStore Init Notice]:', e.message);
  }
}

function getMongooseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Filter matching helper supporting basic MongoDB query operators
 */
function matchesQuery(item, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, value] of Object.entries(query)) {
    if (key === '$or') {
      const orMatched = value.some(subQuery => matchesQuery(item, subQuery));
      if (!orMatched) return false;
      continue;
    }

    if (key === '$and') {
      const andMatched = value.every(subQuery => matchesQuery(item, subQuery));
      if (!andMatched) return false;
      continue;
    }

    const itemVal = item[key];

    if (value instanceof RegExp) {
      if (!value.test(String(itemVal || ''))) return false;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.$gte !== undefined && !(itemVal >= value.$gte)) return false;
      if (value.$lte !== undefined && !(itemVal <= value.$lte)) return false;
      if (value.$gt !== undefined && !(itemVal > value.$gt)) return false;
      if (value.$lt !== undefined && !(itemVal < value.$lt)) return false;
      if (value.$ne !== undefined && itemVal === value.$ne) return false;
      if (value.$in !== undefined && !value.$in.includes(itemVal)) return false;
    } else if (itemVal !== value) {
      if (String(itemVal) !== String(value)) return false;
    }
  }
  return true;
}

/**
 * Create a persistent collection model adapter that seamlessly delegates
 * to Mongoose when connected, or to persistent JSON files when MongoDB is offline.
 */
function createModel(collectionName, mongooseModel) {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);

  const readData = () => {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf-8');
        return [];
      }
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
      return JSON.parse(raw || '[]');
    } catch (e) {
      return [];
    }
  };

  const writeData = (data) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DataStore Notice] Could not write ${collectionName} to local file:`, e.message);
      }
    }
  };

  // Wrapper Query object supporting chaining (.sort(), .limit(), .lean(), .populate(), .select())
  class QueryChain {
    constructor(items, isSingle = false) {
      this.items = [...items];
      this.isSingle = isSingle;
      this.excludedFields = [];
    }

    sort(sortObj = {}) {
      if (typeof sortObj === 'object') {
        const [field, dir] = Object.entries(sortObj)[0] || [];
        if (field) {
          const multiplier = dir === -1 || dir === 'desc' ? -1 : 1;
          this.items.sort((a, b) => {
            const valA = a[field] || '';
            const valB = b[field] || '';
            if (valA < valB) return -1 * multiplier;
            if (valA > valB) return 1 * multiplier;
            return 0;
          });
        }
      }
      return this;
    }

    limit(n) {
      if (n > 0) this.items = this.items.slice(0, n);
      return this;
    }

    select(fields) {
      if (typeof fields === 'string') {
        fields.split(/\s+/).forEach(f => {
          if (f.startsWith('-')) {
            this.excludedFields.push(f.slice(1));
          }
        });
      }
      return this;
    }

    populate() {
      return this;
    }

    lean() {
      const mapped = this.items.map(item => item instanceof ModelWrapper ? item.toObject() : item);
      return this.isSingle ? (mapped[0] || null) : mapped;
    }

    then(resolve, reject) {
      let result = this.isSingle ? (this.items[0] || null) : this.items;
      if (result && this.excludedFields.length > 0) {
        if (Array.isArray(result)) {
          result.forEach(r => {
            this.excludedFields.forEach(f => { delete r[f]; });
          });
        } else {
          this.excludedFields.forEach(f => { delete result[f]; });
        }
      }
      return Promise.resolve(result).then(resolve, reject);
    }

    catch(reject) {
      return this.then(undefined, reject);
    }
  }

  // Model class with Mongoose-compatible static methods
  class ModelWrapper {
    constructor(data = {}) {
      const { _doc, ...cleanData } = data;
      const initial = _doc ? { ..._doc, ...cleanData } : cleanData;
      this._id = initial._id || crypto.randomBytes(12).toString('hex');
      this.createdAt = initial.createdAt || new Date().toISOString();
      this.updatedAt = initial.updatedAt || new Date().toISOString();
      Object.assign(this, initial);
    }

    toObject() {
      const obj = {};
      for (const key of Object.keys(this)) {
        if (key !== '_doc' && typeof this[key] !== 'function') {
          obj[key] = this[key];
        }
      }
      return obj;
    }

    async save() {
      if (getMongooseConnected()) {
        const plain = this.toObject();
        if (this._isPersisted || (this._id && !this._isNew)) {
          const res = await mongooseModel.findByIdAndUpdate(this._id, plain, { new: true, upsert: true });
          if (res) Object.assign(this, res.toObject ? res.toObject() : res);
          return this;
        }
        try {
          const doc = new mongooseModel(plain);
          const res = await doc.save();
          this._isPersisted = true;
          this._isNew = false;
          Object.assign(this, res.toObject ? res.toObject() : res);
          return this;
        } catch (saveErr) {
          if (saveErr.code === 11000 && this._id) {
            const res = await mongooseModel.findByIdAndUpdate(this._id, plain, { new: true });
            if (res) Object.assign(this, res.toObject ? res.toObject() : res);
            this._isPersisted = true;
            return this;
          }
          throw saveErr;
        }
      }

      const list = readData();
      const existingIdx = list.findIndex(x => (x.id && x.id === this.id) || (x._id && x._id === this._id));
      this.updatedAt = new Date().toISOString();
      const plainObj = this.toObject();

      if (existingIdx !== -1) {
        list[existingIdx] = plainObj;
      } else {
        list.unshift(plainObj);
      }
      writeData(list);
      return this;
    }

    static async countDocuments(query = {}) {
      if (getMongooseConnected()) {
        return await mongooseModel.countDocuments(query);
      }
      const list = readData();
      return list.filter(item => matchesQuery(item, query)).length;
    }

    static find(query = {}) {
      if (getMongooseConnected()) {
        return mongooseModel.find(query);
      }
      const list = readData();
      const matches = list.filter(item => matchesQuery(item, query)).map(x => new ModelWrapper(x));
      return new QueryChain(matches);
    }

    static findOne(query = {}) {
      if (getMongooseConnected()) {
        return mongooseModel.findOne(query);
      }
      const list = readData();
      const match = list.find(item => matchesQuery(item, query));
      return new QueryChain(match ? [new ModelWrapper(match)] : [], true);
    }

    static findById(id) {
      if (getMongooseConnected()) {
        return mongooseModel.findById(id);
      }
      const list = readData();
      const match = list.find(item => item._id === id || item.id === id);
      return new QueryChain(match ? [new ModelWrapper(match)] : [], true);
    }

    static async findOneAndUpdate(query, update, options = {}) {
      if (getMongooseConnected()) {
        return await mongooseModel.findOneAndUpdate(query, update, options);
      }
      const list = readData();
      let matchIdx = list.findIndex(item => matchesQuery(item, query));
      
      const updateData = update.$set ? update.$set : (update.$push ? {} : update);
      const incData = update.$inc || {};
      const pushData = update.$push || {};

      if (matchIdx === -1) {
        if (options.upsert) {
          const newDoc = {
            _id: crypto.randomBytes(12).toString('hex'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...query,
            ...updateData
          };
          for (const [k, v] of Object.entries(incData)) {
            newDoc[k] = (newDoc[k] || 0) + v;
          }
          for (const [k, v] of Object.entries(pushData)) {
            newDoc[k] = [v];
          }
          list.push(newDoc);
          writeData(list);
          return new ModelWrapper(newDoc);
        }
        return null;
      }

      for (const [k, v] of Object.entries(updateData)) {
        list[matchIdx][k] = v;
      }
      for (const [k, v] of Object.entries(incData)) {
        list[matchIdx][k] = (list[matchIdx][k] || 0) + v;
      }
      for (const [k, v] of Object.entries(pushData)) {
        if (!Array.isArray(list[matchIdx][k])) list[matchIdx][k] = [];
        list[matchIdx][k].push(v);
      }
      list[matchIdx].updatedAt = new Date().toISOString();
      writeData(list);
      return new ModelWrapper(list[matchIdx]);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
      return ModelWrapper.findOneAndUpdate({ _id: id }, update, options);
    }

    static async findOneAndDelete(query) {
      if (getMongooseConnected()) {
        return await mongooseModel.findOneAndDelete(query);
      }
      const list = readData();
      const matchIdx = list.findIndex(item => matchesQuery(item, query));
      if (matchIdx !== -1) {
        const removed = list.splice(matchIdx, 1)[0];
        writeData(list);
        return new ModelWrapper(removed);
      }
      return null;
    }

    static async findByIdAndDelete(id) {
      return ModelWrapper.findOneAndDelete({ _id: id });
    }

    static async deleteOne(query) {
      if (getMongooseConnected()) {
        return await mongooseModel.deleteOne(query);
      }
      const list = readData();
      const matchIdx = list.findIndex(item => matchesQuery(item, query));
      if (matchIdx !== -1) {
        list.splice(matchIdx, 1);
        writeData(list);
        return { acknowledged: true, deletedCount: 1 };
      }
      return { acknowledged: true, deletedCount: 0 };
    }

    static async deleteMany(query) {
      if (getMongooseConnected()) {
        return await mongooseModel.deleteMany(query);
      }
      const list = readData();
      const kept = list.filter(item => !matchesQuery(item, query));
      const deletedCount = list.length - kept.length;
      writeData(kept);
      return { acknowledged: true, deletedCount };
    }

    static async insertMany(items) {
      if (getMongooseConnected()) {
        return await mongooseModel.insertMany(items);
      }
      const list = readData();
      const created = items.map(item => ({
        _id: item._id || crypto.randomBytes(12).toString('hex'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...item
      }));
      list.push(...created);
      writeData(list);
      return created.map(x => new ModelWrapper(x));
    }

    static async create(data) {
      const doc = new ModelWrapper(data);
      await doc.save();
      return doc;
    }
  }

  return ModelWrapper;
}

module.exports = {
  createModel,
  getMongooseConnected,
  DATA_DIR
};
