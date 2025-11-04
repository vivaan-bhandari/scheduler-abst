# Railway Deployment Steps - Paycom SFTP

## ✅ Step 1: Update Railway Environment Variable

1. Go to: https://railway.app
2. Select your project: **scheduler-abst**
3. Click on the **scheduler-abst** service
4. Go to the **Variables** tab
5. Find **PAYCOM_SFTP_PASSWORD**
6. Update it to: `JrP1nd76uqg7LTt4@`
7. Click **Save**

Railway will automatically redeploy after you save (wait 2-3 minutes).

---

## ✅ Step 2: Verify Environment Variables

Make sure these are set in Railway:

```
PAYCOM_SFTP_HOST=push.paycomonline.net
PAYCOM_SFTP_PORT=22
PAYCOM_SFTP_USERNAME=000_10a54_internalad
PAYCOM_SFTP_PASSWORD=JrP1nd76uqg7LTt4@
PAYCOM_SFTP_REMOTE_DIRECTORY=/Outbound
```

---

## ✅ Step 3: Test Local Connection First

Before deploying, test locally:

```bash
cd backend
source venv/bin/activate
python test_paycom_sftp.py
```

This should connect successfully. If it fails, fix local issues before deploying.

---

## ✅ Step 4: Wait for Railway Deployment

After updating the password:
1. Check Railway dashboard → Deployments tab
2. Wait for "Deploy successful" (2-3 minutes)
3. Check logs for any errors

---

## ✅ Step 5: Test Sync on Railway

1. Open: https://scheduler-abst.vercel.app
2. Log in
3. Go to: **Paycom Integration** → **Sync Controls** tab
4. Click: **Sync Now**
5. Wait up to 3 minutes (timeout is set to 180s)
6. Check for success message

---

## ✅ Step 6: Check Railway Logs

If sync fails:
1. Go to Railway dashboard
2. Open scheduler-abst service
3. Click **Logs** or **Deployments** tab
4. Look for:
   - "Password before workaround"
   - "SFTP connection"
   - "Authentication failed"
   - Any error messages

---

## 🎯 What Makayla Fixed

According to her email:
- ✅ Account reactivated
- ✅ Updated setting to allow multiple connections at once
- ✅ Confirmed password is correct

The password `JrP1nd76uqg7LTt4@` has no special characters that would cause Railway issues!

---

## 📋 Troubleshooting

**If sync still fails:**

1. Check Railway logs for authentication errors
2. Verify the password in Railway matches exactly: `JrP1nd76uqg7LTt4@`
3. Make sure Railway deployment finished successfully
4. Try the sync again after waiting 1-2 minutes

**If account gets suspended again:**
- Contact Makayla (makayla.huddleston@paycomonline.com)
- She mentioned updating settings to allow multiple connections

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Sync completes without timeout (takes 1-3 minutes)
- ✅ "Sync started successfully!" message appears
- ✅ Sync history shows completed syncs
- ✅ Employee data appears in Paycom Integration → Employees tab

