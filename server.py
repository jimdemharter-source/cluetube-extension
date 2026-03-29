# server.py
# TrueView Python Backend Server
# Uses youtube-transcript-api to robustly fetch YouTube transcripts

import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__)
CORS(app)  # Allows Chrome Extension to talk to this server

# Cookie file path (Netscape/Mozilla format) - optional but helps avoid blocks
COOKIES_FILE = "cookies.txt"

def create_session_with_cookies():
    """Create a requests session with cookies if available."""
    import requests
    from http.cookiejar import MozillaCookieJar
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    
    if os.path.exists(COOKIES_FILE):
        try:
            cj = MozillaCookieJar(COOKIES_FILE)
            cj.load(ignore_discard=True, ignore_expires=True)
            session.cookies = cj
            print(f"[OK] Loaded cookies from {COOKIES_FILE}")
        except Exception as e:
            print(f"[!] Failed to load cookies: {e}")
    
    return session

def _fetch_transcript_data(video_id, use_cookies=True):
    """Core transcript fetching logic. Returns (transcript_data, language, is_generated) or raises."""
    if use_cookies and os.path.exists(COOKIES_FILE):
        session = create_session_with_cookies()
        api = YouTubeTranscriptApi(http_client=session)
    else:
        api = YouTubeTranscriptApi()
    
    # List available transcripts
    transcript_list = api.list(video_id)
    
    # Try to get any transcript (manual first, then auto-generated)
    transcript_obj = None
    try:
        for t in transcript_list:
            if not t.is_generated:
                transcript_obj = t
                break
    except:
        pass
    
    if not transcript_obj:
        try:
            for t in transcript_list:
                if t.is_generated:
                    transcript_obj = t
                    break
        except:
            pass
    
    if not transcript_obj:
        transcript_obj = next(iter(transcript_list))  # raises StopIteration if empty
    
    fetched = transcript_obj.fetch()
    return fetched.to_raw_data(), transcript_obj.language, transcript_obj.is_generated


@app.route('/get_transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('videoId')
    
    if not video_id:
        return jsonify({"success": False, "error": "No videoId provided"}), 400

    print(f"Fetching transcript for: {video_id}")

    try:
        # Try with cookies first, fall back to without if cookies cause issues
        transcript_data = None
        lang_info = ""
        try:
            data, lang, is_gen = _fetch_transcript_data(video_id, use_cookies=True)
            transcript_data = data
            lang_info = f"{lang} ({'auto-generated' if is_gen else 'manual'})"
        except Exception as cookie_err:
            if os.path.exists(COOKIES_FILE):
                print(f"[!] Cookie-based fetch failed ({type(cookie_err).__name__}), retrying without cookies...")
                data, lang, is_gen = _fetch_transcript_data(video_id, use_cookies=False)
                transcript_data = data
                lang_info = f"{lang} ({'auto-generated' if is_gen else 'manual'})"
            else:
                raise  # No cookies to fall back from, re-raise original error
        
        print(f"Found transcript in: {lang_info}")
        
        # Build transcript with timestamps for accurate referencing
        timed_parts = []
        text_only_parts = []
        for snippet in transcript_data:
            start_sec = int(snippet['start'])
            mins = start_sec // 60
            secs = start_sec % 60
            timed_parts.append(f"[{mins}:{secs:02d}] {snippet['text']}")
            text_only_parts.append(snippet['text'])
        
        timed_transcript = "\n".join(timed_parts)
        full_text = " ".join(text_only_parts)
        
        # Clean: Remove excessive whitespace/newlines from plain text
        full_text = re.sub(r'\s+', ' ', full_text).strip()

        if not full_text:
            return jsonify({"success": False, "error": "Transcript was empty."}), 404

        print(f"[OK] Got transcript: {len(full_text)} chars, {len(timed_parts)} segments")
        return jsonify({
            "success": True, 
            "transcript": full_text,
            "timedTranscript": timed_transcript
        })

    except StopIteration:
        return jsonify({"success": False, "error": "No transcript available for this video."}), 404

    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"Error [{error_type}]: {error_msg}")
        
        if 'disabled' in error_msg.lower() or 'TranscriptsDisabled' in error_type:
            return jsonify({"success": False, "error": "Transcripts disabled for this video."}), 404
        
        if 'no transcript' in error_msg.lower() or 'NotFound' in error_type or 'NoTranscript' in error_type:
            return jsonify({"success": False, "error": "No English transcript available."}), 404
            
        if 'could not retrieve' in error_msg.lower():
            return jsonify({"success": False, "error": "Could not retrieve transcript."}), 404
        
        if 'too many requests' in error_msg.lower() or 'blocked' in error_msg.lower():
            return jsonify({"success": False, "error": "Rate limited. Try again in a minute."}), 429
        
        return jsonify({"success": False, "error": f"Error: {error_msg[:150]}"}), 500

# YouTube Data API for comments
YOUTUBE_API_KEY = "AIzaSyB2yuuV1GtW7Lf15m2Y4YRr02nN4qDVea4"

@app.route('/get_comments', methods=['GET'])
def get_comments():
    """Fetch top-level YouTube comments for sentiment analysis."""
    import requests
    
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({"success": False, "error": "No videoId provided"}), 400
    
    print(f"Fetching comments for: {video_id}")
    
    try:
        url = "https://www.googleapis.com/youtube/v3/commentThreads"
        params = {
            "key": YOUTUBE_API_KEY,
            "videoId": video_id,
            "part": "snippet",
            "order": "relevance",
            "maxResults": 50,
            "textFormat": "plainText"
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        # Check for errors
        if "error" in data:
            error_reason = data["error"].get("errors", [{}])[0].get("reason", "unknown")
            if error_reason == "commentsDisabled":
                return jsonify({"success": True, "comments": "", "disabled": True})
            return jsonify({"success": False, "error": f"API error: {error_reason}"}), 400
        
        # Extract top-level comments only
        comments = []
        for item in data.get("items", []):
            text = item["snippet"]["topLevelComment"]["snippet"]["textDisplay"]
            comments.append(text)
        
        if not comments:
            return jsonify({"success": True, "comments": "", "count": 0})
        
        comments_string = "\n".join(comments)
        print(f"[OK] Got {len(comments)} comments")
        
        return jsonify({
            "success": True,
            "comments": comments_string,
            "count": len(comments)
        })
        
    except Exception as e:
        print(f"Comments error: {e}")
        return jsonify({"success": False, "error": str(e)[:100]}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("TrueView Backend Server v2.0")
    print("=" * 50)
    if os.path.exists(COOKIES_FILE):
        print(f"[OK] Cookie file found: {COOKIES_FILE}")
    else:
        print(f"[!] No cookies.txt - may get blocked by YouTube")
        print(f"  Tip: Export cookies from browser while logged into YouTube")
    print()
    print("Starting server on http://127.0.0.1:5000")
    print("=" * 50)
    app.run(port=5000)
