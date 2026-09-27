/* IndexedDB has room for embedded scene images; legacy text projects still load. */
const QuestStorage = (() => {
  let database;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('macroquest', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Хранилище занято другой вкладкой'));
    });
    return database;
  }
  async function read(key = 'current') {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function write(project, key = 'current') {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Сохранение прервано'));
    });
  }
  return {read, write};
})();
