async function test() {
  try {
    const url = 'https://api.immersivevisionary.name.vn/api/assets/1'
    console.log('Fetching from prod:', url)
    const res = await fetch(url)
    const json: any = await res.json()
    const data = json.data ?? json
    const b64 = data.Base64Data
    console.log('Base64 length:', b64 ? b64.length : null)
    if (b64) {
      console.log('Starts with:', b64.slice(0, 100))
    }
  } catch (e: any) {
    console.error('Error fetching prod:', e.message)
  }
}

test()
