-- Pesan anonim publik (tanpa login): thread tidak punya pengirim (senderId null)
-- dan pesan awalnya tidak punya penulis (authorId null). Tambah FK author + SetNull
-- agar penghapusan user tidak menghapus pesan anonim.
ALTER TABLE "CollabThread" ALTER COLUMN "senderId" DROP NOT NULL;

ALTER TABLE "CollabMessage" ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "CollabMessage"
  ADD CONSTRAINT "CollabMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;
