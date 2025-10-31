# Clear Browser Cache & Force Fresh Deployment

## The Issue
Your changes are committed and pushed, but the frontend is showing the old version. This is usually due to browser caching or Vercel serving a cached build.

## Solution 1: Hard Refresh Browser (Most Common Fix)

### On Chrome/Edge:
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### On Firefox:
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### On Safari:
- **Mac**: `Cmd + Option + R`

### Or manually:
1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

---

## Solution 2: Clear Browser Cache Completely

### Chrome/Edge:
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"

### Firefox:
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cache"
3. Time range: "Everything"
4. Click "Clear Now"

### Safari:
1. Safari → Preferences → Advanced
2. Check "Show Develop menu"
3. Develop → Empty Caches

---

## Solution 3: Force Vercel to Rebuild

### Option A: Empty Cache and Redeploy
1. Go to https://vercel.com
2. Open your `scheduler-abst` project
3. Go to **Settings** → **Build & Development Settings**
4. Scroll to **Build Command** section
5. Click **Clear Build Cache**
6. Go to **Deployments** tab
7. Find the latest deployment
8. Click the **three dots (⋮)** menu
9. Select **Redeploy**
10. Check **"Use existing Build Cache"** is UNCHECKED
11. Click **Redeploy**

### Option B: Trigger a New Build
```bash
# Make a small change to trigger rebuild
echo "# Force rebuild" >> frontend/README.md
git add frontend/README.md
git commit -m "Force rebuild: trigger fresh deployment"
git push origin main
```

---

## Solution 4: Check Vercel Deployment Status

1. Go to https://vercel.com
2. Open your `scheduler-abst` project
3. Check the **Deployments** tab
4. Look for the latest deployment:
   - ✅ **Green checkmark** = Success
   - ⏳ **Spinning icon** = Still building
   - ❌ **Red X** = Failed

### If Deployment Failed:
- Click on the failed deployment
- Check the **Build Logs** for errors
- Fix any errors and push again

### If Deployment is Still Building:
- Wait for it to complete (usually 1-3 minutes)
- You'll get an email when it's done

---

## Solution 5: Verify Changes Are Actually Deployed

### Check the deployed version:
1. Visit your Vercel URL: `https://scheduler-abst.vercel.app`
2. Open Developer Tools (F12)
3. Go to **Network** tab
4. Filter by `JS` files
5. Look for `main.[hash].js` or `WeeklyPlanner.js`
6. Click on the file
7. Check the **Response** tab to see if it has your changes

### Or check the source:
1. Right-click on the page → **View Page Source**
2. Search for "overnight shift" or "scrollY" 
3. If you find these strings, your changes are deployed!

---

## Solution 6: Use Incognito/Private Mode

This bypasses all cache:
1. Open an **Incognito** (Chrome) or **Private** (Firefox) window
2. Visit your Vercel URL
3. Log in and test

If it works in incognito but not regular window → it's a cache issue!

---

## What to Check After Clearing Cache

The new features you should see:
- ✅ **Overnight shift calculations** fixed (22:00-06:00 = 8 hours, not -16)
- ✅ **Daily overtime alerts** (8+ hours in a single day)
- ✅ **Weekly overtime alerts** (40+ hours in a week)
- ✅ **Scroll position preserved** after assignments (no jumping to top)
- ✅ **Correct hour totals** in alert ribbons and staff display

---

## Still Not Working?

If none of the above works:

1. **Check Vercel build logs** for errors
2. **Verify the commit** includes all changes:
   ```bash
   git show 9506731f7:frontend/src/components/Scheduling/WeeklyPlanner.js | grep -i "overnight"
   ```
3. **Check if files are actually pushed**:
   ```bash
   git ls-tree -r HEAD --name-only | grep WeeklyPlanner
   ```
4. **Contact support** with deployment logs if needed

