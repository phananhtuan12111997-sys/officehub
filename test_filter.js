const folders = [{"id":"f76ada6f-7b77-46e5-8075-f405174d64e8","name":"Văn bản chung","created_at":"2026-05-24T06:54:21.733885+00:00","department":"Chung","is_pinned":false,"parent_id":null},{"id":"98597687-5545-4b3b-af2f-b96c6c93311d","name":"Hồ sơ công việc","created_at":"2026-05-24T06:54:34.449018+00:00","department":"Chung","is_pinned":false,"parent_id":null},{"id":"115283c6-fe04-484d-977f-067bdc7672c3","name":"Bảng đánh giá","created_at":"2026-05-24T06:56:46.365664+00:00","department":"Chung","is_pinned":false,"parent_id":null},{"id":"218d2fba-441d-433f-aae8-20ffe05a558f","name":"đánh giá 1","created_at":"2026-05-24T07:53:59.398062+00:00","department":"Chung","is_pinned":false,"parent_id":"115283c6-fe04-484d-977f-067bdc7672c3"},{"id":"f5375a87-a8a7-4c1a-b68c-34dc8f490698","name":"văn bản01","created_at":"2026-05-24T08:03:04.57769+00:00","department":"Kĩ Thuật","is_pinned":false,"parent_id":"115283c6-fe04-484d-977f-067bdc7672c3"},{"id":"b5d968d0-e5fa-4c49-9e60-221e7be9b98d","name":"văn bản 01","created_at":"2026-05-24T08:13:33.357062+00:00","department":"Chung","is_pinned":false,"parent_id":"115283c6-fe04-484d-977f-067bdc7672c3"}];

const currentFolder = {
  id: "115283c6-fe04-484d-977f-067bdc7672c3",
  department: "Chung"
};

const filterDept = "all";

const filtered = folders
  .filter(f => currentFolder ? f.parent_id === currentFolder.id : !f.parent_id)
  .filter(f => filterDept === "all" ? true : (f.department || "Chung") === filterDept);

console.log(filtered);
