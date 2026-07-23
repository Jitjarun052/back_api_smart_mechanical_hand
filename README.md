🦾 MASTER CHANGELOG: บันทึกมหากาพย์การสร้างระบบหลังบ้าน (Glove Rehabilitation API)
📌 PHASE 1: การวางรากฐานและจัดโครงสร้างระบบ (The Foundation)
สร้างระบบเซิร์ฟเวอร์หลัก (server.js): ติดตั้งและคอนฟิกโปรเจกต์ด้วย Node.js และ Express เป็นฐานขับเคลื่อนหลัก รันบนพอร์ต 5000

เชื่อมต่อฐานข้อมูล (src/config/db.js): เขียนคำสั่งเชื่อมต่อไปยัง MySQL Database ที่ชื่อว่า glove_db โดยใช้สิทธิ์ root ผ่าน XAMPP/phpMyAdmin

วางสถาปัตยกรรมแบบแยกเลเยอร์ (Architecture): แบ่งโครงสร้างโค้ดอย่างเป็นระบบเพื่อไม่ให้โค้ดปนกัน:

routes/ (ป้ายบอกทาง/เส้นทาง API)

controllers/ (ตัวควบคุม Logic ทำงานและติดต่อกับ DB)

📌 PHASE 2: การพัฒนาฟังก์ชันพื้นฐานรอบแรก (Initial CRUD & Authentication)
ระบบผู้ใช้งาน (userController.js & userRoutes.js):

สร้าง API สมัครสมาชิก (/api/user/register) และเข้าสู่ระบบ (/api/user/login) โดยอ้างอิงฟิลด์พื้นฐานอย่าง firstname, lastname, email, phone, password, role

สร้างระบบสำหรับ Admin (getAllUsers และ /api/user/status/:id) เพื่อดึงรายชื่อผู้ใช้ทั้งหมดในระบบไปโชว์เป็นตาราง และสามารถสั่ง Toggle Status (ระงับ/ปลดระงับ) บัญชีผู้ใช้ที่มีปัญหาได้ โดยมีสเตตัสล็อกไว้ถ้าโดนระงับ (status = 1) จะเข้าสู่ระบบไม่ได้

📌 PHASE 3: การยกเครื่องระบบเพื่อรองรับอุปกรณ์ IoT และประวัติผู้ป่วย (The Evolution)
นี่คือช่วงที่เรากำลังทำอยู่ ณ ปัจจุบัน ซึ่งเป็นการปรับระบบหลังบ้านให้เข้ากับ ฟอร์มสมัครสมาชิก 3 สเต็ปบนแอป Flutter (Realme GT 6) และโครงสร้างฐานข้อมูลใหม่ครับ:

1. การล้างข้อมูลและปรับโครงสร้างฐานข้อมูล (Database Refactoring)
เคลียร์สระและตัวสะกดพหูพจน์: ปรับชื่อตารางจากเดิมที่มีปัญหาเรื่องตัว s ให้ตรงกับฐานข้อมูลจริง

ตารางผู้ใช้ล็อกชื่อว่า ➡️ user (ไม่มี s)

ตารางอุปกรณ์ถุงมือกลล็อกชื่อว่า ➡️ device (ไม่มี s)

เพิ่มตารางรองรับคุณหมอ: สร้างตาราง doctors ขึ้นมาแยก เพื่อเก็บประวัติและพ่วงคีย์สัมพันธ์

2. อัปเดตขีดความสามารถของระบบสมัครสมาชิก (3-Step Registration Logic)
เราได้ปรับโค้ดในฟังก์ชัน register ของ userController.js จากเดิมแบบ Callback ซ้อนกันธรรมดา เปลี่ยนมาเป็นรูปแบบ async/await (Promise) เพื่อทำการประมวลผลเป็นทอด ๆ ดังนี้:

สเต็ปที่ 1 (ตรวจเช็ก): เช็กอีเมลซ้ำในระบบ และเช็กข้อมูลบัญชีทั่วไป

สเต็ปที่ 2 (ผูกสัมพันธ์แพทย์): หากผู้ป่วยกรอกรหัสแพทย์ (doctor_code) ระบบหลังบ้านจะแอบวิ่งไปหาคีย์ในตาราง doctors แล้วดึง id มาผูกเป็น doctor_id (Foreign Key) ลงตาราง user ให้ทันที

สเต็ปที่ 3 (ผูกอุปกรณ์ IoT): ถ้ายิงข้อมูลอุปกรณ์พ่วงมาด้วย (serial_number และ device_name) หลังบ้านจะนำ user_id ที่เพิ่งเจเนอเรตสด ๆ ร้อน ๆ ไปผูกบันทึกลงตาราง device ต่อทันทีในคำสั่งเดียว

สิทธิ์และความปลอดภัยขั้นพื้นฐาน: แก้ไขให้หลังบ้านทำหน้าที่ฮาร์ดโค้ดล็อกค่าอัตโนมัติ โดยฝั่งแอปไม่ต้องส่งมา เพื่อความปลอดภัย:

role = 0 (บังคับเป็นผู้ป่วยทุกคนสำหรับการสมัครช่องทางนี้)

status = 0 (เปิดใช้งานทันที ไม่ติดค่าว่างหรือ NULL)

3. อัปเดตระบบเข้าสู่ระบบให้ฉลาดขึ้น (Smart Login)
ปรับปรุงฟังก์ชัน login ให้ใช้คำสั่ง LEFT JOIN doctors เพื่อที่เวลาผู้ป่วยล็อกอินเข้ามาสำเร็จ ระบบหลังบ้านจะม้วนเอาประวัติอาการของผู้ป่วย (age, gender, symptoms) พร้อมกับชื่อคุณหมอและเบอร์โรงพยาบาล มัดรวมเป็นก้อนตอบกลับไปให้ Flutter นำไปสแตนบายโชว์บนหน้าจอแอปได้ทันที

4. การขยายตารางใหม่ (Doctor Management Ecosystem)
สร้างไฟล์คู่ใหม่ขึ้นมาคือ doctorController.js และ doctorRoutes.js พร้อมเปิดเส้นทางผ่าน server.js เป็นสัดส่วน เพื่อใช้สำหรับเพิ่มคุณหมอเข้าระบบ และทำ API เส้นด่วนค้นหาข้อมูลหมอจากรหัสผ่าน URL ปลายทาง (/api/doctor/find/:code)

📌 PHASE 4: โฟลเดอร์และไฟล์ที่สแตนด์บายรอพัฒนาต่อ (Current Status)
deviceController.js / deviceRoutes.js: มีโครงสร้างไฟล์แล้ว รอเขียนระบบจัดการอุปกรณ์รายเครื่อง

historyController.js / historyRoutes.js: มีโครงสร้างไฟล์แล้ว สเต็ปถัดไปคือใช้สำหรับรับค่าสถิติ องศาการขยับ และผลการฝึกที่ยิงมาจากบอร์ด IoT ของถุงมือกลและแขนหุ่นยนต์ เพื่อเก็บประวัติการฟื้นฟูร่างกาย

# 🦾 บันทึกการพัฒนาโปรเจกต์ (Glove Rehabilitation Backend API)

ไฟล์นี้ใช้สำหรับบันทึกโครงสร้าง สถาปัตยกรรม และสิ่งที่ได้สร้างหรือแก้ไขไปแล้ว เพื่อใช้สื่อสารและอัปเดตสถานะการทำงาน

---

## 📅 อัปเดตล่าสุด: วันที่ 24 มิถุนายน 2026

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Completed)

#### 1. ฐานข้อมูล (Database - `glove_db`)
* [x] แก้ไขตารางหลักเป็น `user` (ไม่มีตัว s ตามสถาปัตยกรรมเดี่ยว)
* [x] ตรวจสอบโครงสร้างตาราง `device` (ไม่มีตัว s) ให้สอดรับกับบอร์ด IoT และถุงมือกล
* [x] เพิ่มตาราง `doctors` รองรับข้อมูลแพทย์และการผูกสัมพันธ์ด้วยรหัสแพทย์ (`doctor_code`)

#### 2. ระบบหลังบ้าน (Backend - Node.js Express)
* [x] **`userController.js` & `userRoutes.js`:** * ปรับปรุงระบบสมัครสมาชิก (`register`) รองรับฟอร์ม 3 สเต็ป (ข้อมูลส่วนตัว + ข้อมูลอาการ + ผูกอุปกรณ์ IoT)
  * เพิ่ม Logic ค้นหา `doctor_id` อัตโนมัติเมื่อคนไข้กรอก `doctor_code`
  * ล็อกค่าเริ่มต้นอัตโนมัติ: `status = 0` (ใช้งานปกติ) และ `role = 0` (ผู้ป่วย) โดยหน้าบ้านไม่ต้องส่งมา
  * ปรับปรุงระบบ `login` ให้ทำ `LEFT JOIN` ดึงข้อมูลแพทย์ประจำตัวกลับไปโชว์บนแอป Flutter
* [x] **`doctorController.js` & `doctorRoutes.js`:**
  * สร้างฟังก์ชันเพิ่มข้อมูลแพทย์ใหม่ (`createDoctor`)
  * สร้างฟังก์ชันดึงข้อมูลแพทย์ทั้งหมด (`getAllDoctors`)
  * สร้างฟังก์ชันค้นหาแพทย์รายบุคคลผ่าน URL Parameter ด้วยรหัสแพทย์ (`getDoctorByCode`)
* [x] **`server.js`:** เปิดใช้งาน Router ทะลวงเส้นทาง API ทั้งสองฝั่ง:
  * `/api/user`
  * `/api/doctor`

---

### ⏳ สิ่งที่กำลังจะทำต่อไป (Next Steps)
* [ ] ทดสอบยิง API ฝั่งตารางแพทย์ (`doctor`) ให้มั่นใจว่าข้อมูลเข้าครบถ้วน
* [ ] อัปเดตไฟล์ `historyController.js` และ `historyRoutes.js` เพื่อรองรับการเก็บสถิติการฝึกจากถุงมือกล
* [ ] ปรับแก้โค้ดฝั่งหน้าบ้าน Flutter (Realme GT 6) ให้ยิงข้อมูลเข้า API 3 สเต็ปตัวใหม่นี้

---

### 📥 ข้อมูลสำหรับใช้ทดสอบยิง API (Test Payloads)

#### เส้นทาง: POST `/api/user/register`
```json
{
  "firstname": "พีรพล",
  "lastname": "ใจมั่นคง",
  "email": "peerapol.newtest@glove.com",
  "phone": "0823456789",
  "password": "password9999",
  "age": 45,
  "gender": "ชาย",
  "symptoms": "กล้ามเนื้ออ่อนแรงซีกขวาจากภาวะเส้นเลือดสมองตีบ",
  "emergency_phone": "0851112223",
  "doctor_code": "DOC-99X",
  "serial_number": "Glove-2026-9999",
  "device_name": "ถุงมือกลซิงก์ระบบทู"
}

พื่อให้ระบบบันทึกของเราแม่นยำร้อยเปอร์เซ็นต์ ให้คุณจิตร์จรัญนำบรรทัดนี้ไปแปะเพิ่มในหัวข้อ userController.js & userRoutes.js ของไฟล์บันทึกได้เลยครับ:

[ ] ระบบอัปโหลดรูปภาพผู้ป่วย (Patient Profile Image): เตรียมติดตั้งแพ็กเกจ multer ที่หลังบ้านเพื่อรองรับการรับไฟล์รูปถ่ายจากแอป Flutter และบันทึกชื่อไฟล์ลงคอลัมน์ image ในตาราง user

ตัวฟีเจอร์รูปภาพนี้จัดว่าเป็นทีเด็ดที่ทำให้แอปดูสมบูรณ์และเป็นระบบสากลมากยิ่งขึ้นครับ!

---

## 📅 อัปเดตล่าสุด: วันที่ 24 มิถุนายน 2026 (ระบบรูปภาพผู้ป่วย & แก้ไข Bug)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Completed)

#### 1. ฐานข้อมูล (Database - `glove_db`)
* [x] รันคำสั่ง `ALTER TABLE user ADD COLUMN image VARCHAR(255) NULL AFTER doctor_id;` เพิ่มคอลัมน์สำหรับเก็บชื่อไฟล์รูปภาพโปรไฟล์ผู้ป่วย

#### 2. ระบบหลังบ้าน (Backend - Node.js Express)
* [x] **ติดตั้งแพ็กเกจ Multer:** เพิ่มระบบรองรับการอัปโหลดไฟล์รูปภาพจริงจากหน้าบ้าน (`npm install multer`)
* [x] **`server.js`:** ตั้งค่า `app.use('/uploads', express.static(...))` เพื่อเปิดให้หน้าบ้าน Flutter สามารถดึงรูปภาพโปรไฟล์ไปแสดงผลผ่าน URL ได้โดยตรง
* [x] **`userController.js`:** * คอนฟิก Multer Storage และระบบกรองไฟล์รูปภาพ (`fileFilter`) ป้องกันไฟล์แปลกปลอม
  * ปรับปรุงฟังก์ชัน `register` ให้ตรวจสอบรูปภาพผ่าน `req.file` และนำชื่อไฟล์ที่ถูกสุ่มขึ้นมาใหม่ไปหยอดลงตาราง `user` ในคอลัมน์ `image`
  * จัดการโครงสร้างการส่งออกโมดูลให้อยู่ในรูปแบบ CommonJS (`exports.upload = upload`) ร่วมกับฟังก์ชันเดิมได้อย่างไร้รอยต่อ
* [x] **`userRoutes.js`:** นำ `upload.single('image')` ไปวางดักในเส้นทาง `POST /register` ทำให้รองรับการส่งข้อมูลแบบ **Multipart/Form-Data** สำเร็จ

### 🧪 สรุปผลการทดสอบระบบ (Testing Status)
* [x] ทดสอบยิง API สมัครสมาชิกผ่าน HTTP Request ได้รับ `Status: 200 OK` (ลงทะเบียนสำเร็จ)
* [x] ตรวจสอบระบบล็อกค่าเริ่มต้น: หากหน้าบ้านไม่ได้ส่งค่ามา ระบบหลังบ้านจะล็อกสิทธิ์ผู้ป่วย (`role = 0`) และเปิดใช้งานสถานะบัญชี (`status = 0`) ให้โดยอัตโนมัติอย่างถูกต้อง
* [x] ระบบจัดเก็บข้อมูลสัมพันธ์กับตาราง `device` และ `doctors` ทำงานร่วมกันได้สมบูรณ์

---

## 📌 อัปเดตระบบล่าสุด (30 มิถุนายน 2026)

ทำการเชื่อมต่อระบบหน้าบ้าน (Frontend React) และหลังบ้าน (Backend Node.js API) เข้ากับฐานข้อมูล MySQL จริงครบวงจร พร้อมยกระดับความปลอดภัยของระบบแผงควบคุม (Admin Panel)

### 💻 ฝั่งหน้าบ้าน (Frontend - React & Tailwind CSS)
* **หน้า Dashboard**: ปรับปรุงการดึงข้อมูลตัวเลขสถิติจริงจาก MySQL (จำนวนผู้ป่วย, อุปกรณ์ทั้งหมด, อุปกรณ์ที่ลงทะเบียน) แทนระบบจำลองค่าแบบเดิม[cite: 5]
* **หน้าจัดการแพทย์ (Manage Doctors)**: เชื่อมต่อ API ดึงข้อมูลสด และแก้ไขปัญหาการเรนเดอร์ข้อมูลเรียบร้อย
* **หน้าจัดการอุปกรณ์และ Serial Number (Manage Serials)**: 
  * ปรับโครงสร้างตารางแสดงผลให้รองรับฟิลด์ `device_id` คีย์หลักจาก MySQL[cite: 1]
  * ดึงชื่อเจ้าของเครื่อง (`owner_name`) ผ่านระบบ `LEFT JOIN` เพื่อให้แอดมินและแพทย์ตรวจสอบได้ง่าย
  * เพิ่มปุ่มควบคุมเปิดสิทธิ์/ระงับสิทธิ์การใช้งานตัวเครื่องตัวเครื่อง ยิงอัปเดตสเตตัส (0/1) ลงฐานข้อมูลได้ทันที
  * แก้ไข Syntax บั๊กปีกกาและวงเล็บซ้ำซ้อน (`Syntax Error`) ตรงลูปส่วนแสดงผลตาราง
* **หน้าสถิติภาพรวม (Overall Stats)**: เชื่อมกราฟคอมโพเนนต์ `Recharts` ดึงสถิติผลการฝึกกายภาพบำบัดสะสมรายวันและความแม่นยำเฉลี่ยประจำวัน[cite: 4]
* **หน้าเข้าสู่ระบบ (Login)**: ปรับฟอร์มให้รับค่าเป็น `email` และ `password`[cite: 2] พร้อมเพิ่มระบบความปลอดภัยตรวจสอบสิทธิ์ (Role Verification) โดยจะอนุญาตให้เฉพาะบัญชีที่มีสิทธิ์ `role = 1` (Admin) เข้าใช้งานระบบเท่านั้น

### 📡 ฝั่งหลังบ้าน (Backend - Node.js & Express)
* **JWT Authentication**: 
  * ติดตั้งแพ็กเกจ `jsonwebtoken` เพื่อเปลี่ยนระบบมาใช้การออก Token (JWT) ขากลับตอน Login สำเร็จ เพื่อความปลอดภัยและลดการเก็บข้อมูลส่วนตัวดิบบนเบราว์เซอร์
  * เพิ่มพาร์ทระบุตัวตนใหม่ `GET /api/user/me` เพื่อแกะและถอดรหัสตรวจสอบ Token[cite: 2] สำหรับดึงข้อมูลล่าสุดของผู้ใช้ปัจจุบัน และใช้ดักกรณี Token หมดอายุ (`expiresIn: 1d`)
* **Dashboard API**: แยกโค้ดออกจากโครงสร้างเดิม สร้างไฟล์เราเตอร์ `dashboardRoutes.js` และคอนโทรลเลอร์ `dashboardController.js` เป็นสัดส่วนตามสถาปัตยกรรมที่ถูกต้อง
* **SQL Queries Optimization**: ปรับปรุงชุดคำสั่ง `SELECT` ในคอนโทรลเลอร์ต่างๆ ให้ทำ `LEFT JOIN` ร่วมกับตารางอื่นเพื่อดึงข้อมูลข้ามตารางมาแสดงผลได้ครบถ้วน

จัดเอกสารสรุปรายละเอียดการพัฒนาระบบ **Forgot Password (2-Step Verification)** ในรูปแบบ Markdown (`.md`) ให้เรียบร้อยครับสหาย! คุณสามารถก๊อปปี้ข้อความด้านล่างนี้ไปบันทึกเป็นไฟล์ `FORGOT_PASSWORD_DOCS.md` ในโปรเจกต์ได้เลยครับ 🚀📝✨

---

```markdown
# 🔑 เอกสารพัฒนาระบบ Forgot Password (2-Step Verification)

เอกสารสรุปโครงสร้างและการพัฒนาระบบกู้คืนรหัสผ่านสำหรับแอปพลิเคชันมือกลและแอปพลิเคชันเพื่อสุขภาพ (**Smart Mechanical Hand**) 

---

## 📌 ภาพรวมการทำงาน (Workflow)

ระบบแบ่งออกเป็น **2 ขั้นตอนหลัก** เพื่อความปลอดภัยและการใช้งานที่ลื่นไหล (UX/UI):

```text
[Step 1: Verify Identity] 
  └── กรอก Email + Phone ➔ ยิง API ตรวจสอบ
        ├── ❌ ไม่พบข้อมูล: แสดง Modal แจ้งเตือน และให้กรอกใหม่
        └── ✅ พบข้อมูล: แสดง Modal ยืนยันตัวตน (โชว์ชื่อผู้ใช้) ➔ กด "ยืนยัน" 
              └── [Step 2: Reset Password]
                    └── กรอกรหัสผ่านใหม่ + ยืนยัน ➔ บันทึกลง MySQL ➔ กลับหน้า SignIn

```

---

## 📂 โครงสร้างไฟล์ในโปรเจกต์ (Project Structure)

```text
lib/
├── widgets/
│   └── forgot_password/
│       ├── verify_identity_step.dart    # 📝 Component สเต็ปที่ 1 (กรอก Email & Phone)
│       ├── reset_password_step.dart     # 📝 Component สเต็ปที่ 2 (กรอก รหัสผ่านใหม่)
│       └── forgot_password_dialogs.dart # 🚨 Dialogs (ไม่พบข้อมูล / ยืนยันตัวตน / สำเร็จ)
├── screens/
│   ├── signin_screen.dart               # 🔑 หน้าเข้าสู่ระบบ (เพิ่มปุ่ม "ลืมรหัสผ่าน?")
│   └── forgot_password_screen.dart      # 🏠 หน้าหลัก ควบคุม State & Logic ยิง API
└── api/
    └── auth_service.dart                # 🔌 ฟังก์ชันยิง API ไปยัง Backend

```

---

## 🌐 1. Backend Endpoints (Express / Node.js)

### 1.1 `POST /api/user/verify-identity`

* **คำอธิบาย:** ตรวจสอบว่ามีผู้ใช้อยู่ในฐานข้อมูลหรือไม่
* **Request Body:**
```json
{
  "email": "somsri.newtest@gmail.com",
  "phone": "0823456789"
}

```


* **Response (200 OK):**
```json
{
  "status": "success",
  "message": "ยืนยันตัวตนสำเร็จ",
  "userId": 12,
  "firstname": "สมศรี"
}

```



### 1.2 `POST /api/user/reset-password`

* **คำอธิบาย:** อัปเดตรหัสผ่านใหม่ลงคอลัมน์ `password` ในตาราง `user`
* **Request Body:**
```json
{
  "userId": 12,
  "newPassword": "newpassword123"
}

```


* **Response (200 OK):**
```json
{
  "status": "success",
  "message": "รีเซ็ตรหัสผ่านใหม่เรียบร้อยแล้ว!"
}

```



---

## 🛠️ 2. โค้ดส่วนประกอบหลัก (Flutter Frontend)

### 2.1 `lib/api/auth_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthService {
  static const String baseUrl = 'http://localhost:5000/api';

  // 1. ยิงตรวจสอบตัวตนด้วย Email + Phone
  static Future<Map<String, dynamic>> verifyIdentity({
    required String email,
    required String phone,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/user/verify-identity'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'phone': phone}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'userId': data['userId'],
          'firstname': data['firstname'],
        };
      } else {
        return {'success': false, 'message': data['error'] ?? 'ไม่พบข้อมูลในระบบ'};
      }
    } catch (e) {
      return {'success': false, 'message': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: $e'};
    }
  }

  // 2. ยิงอัปเดตรหัสผ่านใหม่
  static Future<Map<String, dynamic>> resetPassword({
    required int userId,
    required String newPassword,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/user/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId, 'newPassword': newPassword}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'รีเซ็ตสำเร็จ'};
      } else {
        return {'success': false, 'message': data['error'] ?? 'เกิดข้อผิดพลาด'};
      }
    } catch (e) {
      return {'success': false, 'message': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: $e'};
    }
  }
}

```

---

### 2.2 `lib/widgets/forgot_password/forgot_password_dialogs.dart`

```dart
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class ForgotPasswordDialogs {
  // 🚨 Modal กรณีไม่พบบัญชีในระบบ
  static void showNotFoundDialog(BuildContext context, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.error_outline_rounded, color: Colors.red),
            SizedBox(width: 8),
            Text('ไม่พบข้อมูล', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(message, style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ตกลง', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // ✅ Modal ยืนยันชื่อผู้ใช้ก่อนไปหน้าสเต็ป 2
  static void showConfirmIdentityDialog({
    required BuildContext context,
    required String userName,
    required VoidCallback onConfirm,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.verified_user_rounded, color: Colors.green),
            SizedBox(width: 8),
            Text('ยืนยันตัวตนสำเร็จ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'พบข้อมูลบัญชีของคุณ "$userName"\n\nคุณต้องการดำเนินการสร้างรหัสผ่านใหม่ใช่หรือไม่?',
          style: const TextStyle(fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ยกเลิก', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            onPressed: () {
              Navigator.pop(context);
              onConfirm();
            },
            child: const Text('ยืนยัน', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // 🎉 Modal แสดงความยินดีเมื่อตั้งรหัสผ่านใหม่สำเร็จ
  static void showSuccessDialog(BuildContext context, VoidCallback onSuccess) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green),
            SizedBox(width: 8),
            Text('สำเร็จ'),
          ],
        ),
        content: const Text('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่'),
        actions: [
          TextButton(
            onPressed: onSuccess,
            child: const Text('ตกลง', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

```

---

## 🎯 สรุปผลการทดสอบ (Testing Checkpoints)

1. **กรณีใส่ Email / Phone ผิดหรือไม่มีในระบบ:**
* [x] ต้องเด้ง Modal สีแดงว่า "ไม่พบข้อมูล"
* [x] กด "ตกลง" แล้วปิด Dialog เพื่อให้ผู้ใช้แก้ไขข้อมูลในหน้าเดิมได้


2. **กรณีใส่ Email / Phone ถูกต้อง:**
* [x] ต้องเด้ง Modal สีเขียว "พบข้อมูลบัญชีของคุณ [ชื่อผู้ป่วย]"
* [x] กด "ยืนยัน" แล้วสลับไปยังหน้า Step 2 (ตั้งรหัสผ่านใหม่)


3. **กรณีตั้งรหัสผ่านใหม่เรียบร้อย:**
* [x] บันทึกข้อมูลเข้า MySQL สำเร็จ
* [x] เด้ง Modal สำเร็จ ➔ กด "ตกลง" แล้วเด้งกลับหน้า SignIn



```

```