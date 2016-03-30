var jsrsasign = require('jsrsasign');
var rsaKey = jsrsasign.KEYUTIL.generateKeypair("RSA", 1024);
var e = jsrsasign.hextob64u(rsaKey.pubKeyObj.e.toString(16));
var n = jsrsasign.hextob64u(rsaKey.pubKeyObj.n.toString(16));

var path = '/oidc';
var metadataPath = path + '/.well-known/openid-configuration';
var signingKeysPath = path + '/.well-known/jwks';
var authorizationPath = path + '/connect/authorize';
var userInfoPath = path + '/connect/userinfo';
var endSessionPath = path + '/connect/endsession';

var metadata = {
    issuer: path,
    jwks_uri: signingKeysPath,
    authorization_endpoint: authorizationPath,
    userinfo_endpoint: userInfoPath,
    end_session_endpoint: endSessionPath,
};

function prependBaseUrlToMetadata(baseUrl){
    for(var name in metadata){
        metadata[name] = baseUrl + metadata[name]; 
    }
}

var keys = {
    keys: [
        {
            kty: "RSA",
            use: "sig",
            kid: "1",
            e: e,
            n: n
        }
    ]
};

var claims = {
    "sub":"818727",
    "email":"AliceSmith@email.com",
    "email_verified":true,
    "role":["Admin","Geek"]
};

var access_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6ImEzck1VZ01Gdjl0UGNsTGE2eUYzekFrZnF1RSIsImtpZCI6ImEzck1VZ01Gdjl0UGNsTGE2eUYzekFrZnF1RSJ9.eyJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo0NDMzMy9jb3JlIiwiYXVkIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NDQzMzMvY29yZS9yZXNvdXJjZXMiLCJleHAiOjE0NTkzNzgxNjksIm5iZiI6MTQ1OTM3NDU2OSwiY2xpZW50X2lkIjoianMudG9rZW5tYW5hZ2VyIiwic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSIsImVtYWlsIiwicmVhZCIsIndyaXRlIl0sInN1YiI6IjgxODcyNyIsImF1dGhfdGltZSI6MTQ1OTM3NDUyMCwiaWRwIjoiaWRzcnYiLCJhbXIiOlsicGFzc3dvcmQiXX0.Sbr9FcCkx2vMdfCmetF0KzVU-qZlQEXc_Nvp85DSBTX8Cdrh5EpyRn3smN6mzGGq96nDNElIwRsqqEdFImewSMEpPueyXtHEG6rzlIBYvgXo4rhCLroCrDg_DTUCyHoniKHtwz1-MUoxDhef0VVyUWavZ5KmZx-U7-3yN_NlU3CxnDUxq_BLK2IHna3ZldeIhSVFqP9005BUuLsxiyVPV-EJtGaQ8-6VHCLKcmSHqsmwUNzrZoCjdUTm17_YkcLWtAx_dp0vq56mGjwqVREz_ykMMJqBA7Q1S33QHV9L6K_CFYyFLBBhtlzmrgI5QyIBJltd3H5AOKPz1LFKVKToMQ";
var at_hash = "H-4BBL3VfBLNSBcwQuwkuQ";

function genIdToken(aud, nonce, access_token) {
    var now = parseInt(Date.now()/1000);
    var payload = {
        aud : aud,
        iss : metadata.issuer,
        nonce : nonce,
        sid : Math.random(),
        nbf : now,
        iat : now,
        exp : now + 300,
        idp : "some_idp", 
        amr : [ "password" ]
    };

    if (access_token) {
        payload.at_hash = at_hash;
    }
    
    for(var key in claims){
        payload[key] = claims[key];
    }    
    
    return jsrsasign.jws.JWS.sign(null, {alg: "RS256", kid: "1"}, payload, rsaKey.prvKeyObj);
}

function isOidc(response_type) {
    var result = response_type.split(/\s+/g).filter(function(item) {
        return item === "id_token";
    });
    return !!(result[0]);
}

function isOAuth(response_type) {
    var result = response_type.split(/\s+/g).filter(function(item) {
        return item === "token";
    });
    return !!(result[0]);
}

function addFragment(url, name, value) {
    if (url.indexOf('#') < 0) {
        url += "#";
    }

    if (url[url.length - 1] !== "#") {
        url += "&";
    }

    url += encodeURIComponent(name);
    url += "=";
    url += encodeURIComponent(value);

    return url;
}
    
module.exports = function(baseUrl, app) {
    prependBaseUrlToMetadata(baseUrl);
    
    app.get(metadataPath, function (req, res) {
        res.json(metadata);
    });
    
    app.get(signingKeysPath, function (req, res) {
        res.json(keys);
    });
    
    app.get(authorizationPath, function (req, res) {
        var response_type = req.query.response_type;
         
        var url = req.query.redirect_uri;
        
        if (isOAuth(response_type)){
            var access_token = Math.random();
            url = addFragment(url, "token", access_token);
            url = addFragment(url, "token_type", "Bearer");
            url = addFragment(url, "expires_in", "3600");
            url = addFragment(url, "scope", req.query.scope);
        }
        
        if (isOidc(response_type)){
            url = addFragment(url, "id_token", genIdToken(req.query.client_id, req.query.nonce, access_token));
            url = addFragment(url, "session_state", "123");
        }
        
        var state = req.query.state;
        if (state){
            url = addFragment(url, "state", state);
        }
        
        res.redirect(url);
    });
    
    app.get(userInfoPath, function (req, res) {
        res.json(claims);
    });
    
    app.get(endSessionPath, function (req, res) {
        var url = req.query.post_logout_redirect_uri;
        if (url){
            var state = req.query.state;
            res.redirect(url + "?state=" + state);;
        }
        else {
            res.send("logged out");
        }
    });    
}
