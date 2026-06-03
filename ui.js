var D, d, Y, C, K, Z, ee, _e, V, $, j, M = {}, ne = [], pe = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, L = Array.isArray;
function k(_, e) {
    for(var t in e)_[t] = e[t];
    return _;
}
function z(_) {
    _ && _.parentNode && _.parentNode.removeChild(_);
}
function fe(_, e, t) {
    var o, l, n, i = {};
    for(n in e)n == "key" ? o = e[n] : n == "ref" ? l = e[n] : i[n] = e[n];
    if (arguments.length > 2 && (i.children = arguments.length > 3 ? D.call(arguments, 2) : t), typeof _ == "function" && _.defaultProps != null) for(n in _.defaultProps)i[n] === void 0 && (i[n] = _.defaultProps[n]);
    return E(_, i, o, l, null);
}
function E(_, e, t, o, l) {
    var n = {
        type: _,
        props: e,
        key: t,
        ref: o,
        __k: null,
        __: null,
        __b: 0,
        __e: null,
        __c: null,
        constructor: void 0,
        __v: l ?? ++Y,
        __i: -1,
        __u: 0
    };
    return l == null && d.vnode != null && d.vnode(n), n;
}
function I(_) {
    return _.children;
}
function N(_, e) {
    this.props = _, this.context = e;
}
function S(_, e) {
    if (e == null) return _.__ ? S(_.__, _.__i + 1) : null;
    for(var t; e < _.__k.length; e++)if ((t = _.__k[e]) != null && t.__e != null) return t.__e;
    return typeof _.type == "function" ? S(_) : null;
}
function re(_) {
    var e, t;
    if ((_ = _.__) != null && _.__c != null) {
        for(_.__e = _.__c.base = null, e = 0; e < _.__k.length; e++)if ((t = _.__k[e]) != null && t.__e != null) {
            _.__e = _.__c.base = t.__e;
            break;
        }
        return re(_);
    }
}
function B(_) {
    (!_.__d && (_.__d = !0) && C.push(_) && !H.__r++ || K != d.debounceRendering) && ((K = d.debounceRendering) || Z)(H);
}
function H() {
    for(var _, e, t, o, l, n, i, u = 1; C.length;)C.length > u && C.sort(ee), _ = C.shift(), u = C.length, _.__d && (t = void 0, o = void 0, l = (o = (e = _).__v).__e, n = [], i = [], e.__P && ((t = k({}, o)).__v = o.__v + 1, d.vnode && d.vnode(t), q(e.__P, t, o, e.__n, e.__P.namespaceURI, 32 & o.__u ? [
        l
    ] : null, n, l ?? S(o), !!(32 & o.__u), i), t.__v = o.__v, t.__.__k[t.__i] = t, ie(n, t, i), o.__e = o.__ = null, t.__e != l && re(t)));
    H.__r = 0;
}
function oe(_, e, t, o, l, n, i, u, f, s, p) {
    var r, v, c, m, g, y, a, h = o && o.__k || ne, w = e.length;
    for(f = ae(t, e, h, f, w), r = 0; r < w; r++)(c = t.__k[r]) != null && (v = c.__i == -1 ? M : h[c.__i] || M, c.__i = r, y = q(_, c, v, l, n, i, u, f, s, p), m = c.__e, c.ref && v.ref != c.ref && (v.ref && G(v.ref, null, c), p.push(c.ref, c.__c || m, c)), g == null && m != null && (g = m), (a = !!(4 & c.__u)) || v.__k === c.__k ? f = le(c, f, _, a) : typeof c.type == "function" && y !== void 0 ? f = y : m && (f = m.nextSibling), c.__u &= -7);
    return t.__e = g, f;
}
function ae(_, e, t, o, l) {
    var n, i, u, f, s, p = t.length, r = p, v = 0;
    for(_.__k = new Array(l), n = 0; n < l; n++)(i = e[n]) != null && typeof i != "boolean" && typeof i != "function" ? (f = n + v, (i = _.__k[n] = typeof i == "string" || typeof i == "number" || typeof i == "bigint" || i.constructor == String ? E(null, i, null, null, null) : L(i) ? E(I, {
        children: i
    }, null, null, null) : i.constructor == null && i.__b > 0 ? E(i.type, i.props, i.key, i.ref ? i.ref : null, i.__v) : i).__ = _, i.__b = _.__b + 1, u = null, (s = i.__i = de(i, t, f, r)) != -1 && (r--, (u = t[s]) && (u.__u |= 2)), u == null || u.__v == null ? (s == -1 && (l > p ? v-- : l < p && v++), typeof i.type != "function" && (i.__u |= 4)) : s != f && (s == f - 1 ? v-- : s == f + 1 ? v++ : (s > f ? v-- : v++, i.__u |= 4))) : _.__k[n] = null;
    if (r) for(n = 0; n < p; n++)(u = t[n]) != null && (2 & u.__u) == 0 && (u.__e == o && (o = S(u)), ue(u, u));
    return o;
}
function le(_, e, t, o) {
    var l, n;
    if (typeof _.type == "function") {
        for(l = _.__k, n = 0; l && n < l.length; n++)l[n] && (l[n].__ = _, e = le(l[n], e, t, o));
        return e;
    }
    _.__e != e && (o && (e && _.type && !e.parentNode && (e = S(_)), t.insertBefore(_.__e, e || null)), e = _.__e);
    do e = e && e.nextSibling;
    while (e != null && e.nodeType == 8)
    return e;
}
function de(_, e, t, o) {
    var l, n, i, u = _.key, f = _.type, s = e[t], p = s != null && (2 & s.__u) == 0;
    if (s === null && _.key == null || p && u == s.key && f == s.type) return t;
    if (o > (p ? 1 : 0)) {
        for(l = t - 1, n = t + 1; l >= 0 || n < e.length;)if ((s = e[i = l >= 0 ? l-- : n++]) != null && (2 & s.__u) == 0 && u == s.key && f == s.type) return i;
    }
    return -1;
}
function Q(_, e, t) {
    e[0] == "-" ? _.setProperty(e, t ?? "") : _[e] = t == null ? "" : typeof t != "number" || pe.test(e) ? t : t + "px";
}
function F(_, e, t, o, l) {
    var n, i;
    e: if (e == "style") if (typeof t == "string") _.style.cssText = t;
    else {
        if (typeof o == "string" && (_.style.cssText = o = ""), o) for(e in o)t && e in t || Q(_.style, e, "");
        if (t) for(e in t)o && t[e] == o[e] || Q(_.style, e, t[e]);
    }
    else if (e[0] == "o" && e[1] == "n") n = e != (e = e.replace(_e, "$1")), i = e.toLowerCase(), e = i in _ || e == "onFocusOut" || e == "onFocusIn" ? i.slice(2) : e.slice(2), _.l || (_.l = {}), _.l[e + n] = t, t ? o ? t.u = o.u : (t.u = V, _.addEventListener(e, n ? j : $, n)) : _.removeEventListener(e, n ? j : $, n);
    else {
        if (l == "http://www.w3.org/2000/svg") e = e.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
        else if (e != "width" && e != "height" && e != "href" && e != "list" && e != "form" && e != "tabIndex" && e != "download" && e != "rowSpan" && e != "colSpan" && e != "role" && e != "popover" && e in _) try {
            _[e] = t ?? "";
            break e;
        } catch  {}
        typeof t == "function" || (t == null || t === !1 && e[4] != "-" ? _.removeAttribute(e) : _.setAttribute(e, e == "popover" && t == 1 ? "" : t));
    }
}
function X(_) {
    return function(e) {
        if (this.l) {
            var t = this.l[e.type + _];
            if (e.t == null) e.t = V++;
            else if (e.t < t.u) return;
            return t(d.event ? d.event(e) : e);
        }
    };
}
function q(_, e, t, o, l, n, i, u, f, s) {
    var p, r, v, c, m, g, y, a, h, w, x, W, U, J, A, T, R, b = e.type;
    if (e.constructor != null) return null;
    128 & t.__u && (f = !!(32 & t.__u), n = [
        u = e.__e = t.__e
    ]), (p = d.__b) && p(e);
    e: if (typeof b == "function") try {
        if (a = e.props, h = "prototype" in b && b.prototype.render, w = (p = b.contextType) && o[p.__c], x = p ? w ? w.props.value : p.__ : o, t.__c ? y = (r = e.__c = t.__c).__ = r.__E : (h ? e.__c = r = new b(a, x) : (e.__c = r = new N(a, x), r.constructor = b, r.render = me), w && w.sub(r), r.props = a, r.state || (r.state = {}), r.context = x, r.__n = o, v = r.__d = !0, r.__h = [], r._sb = []), h && r.__s == null && (r.__s = r.state), h && b.getDerivedStateFromProps != null && (r.__s == r.state && (r.__s = k({}, r.__s)), k(r.__s, b.getDerivedStateFromProps(a, r.__s))), c = r.props, m = r.state, r.__v = e, v) h && b.getDerivedStateFromProps == null && r.componentWillMount != null && r.componentWillMount(), h && r.componentDidMount != null && r.__h.push(r.componentDidMount);
        else {
            if (h && b.getDerivedStateFromProps == null && a !== c && r.componentWillReceiveProps != null && r.componentWillReceiveProps(a, x), !r.__e && r.shouldComponentUpdate != null && r.shouldComponentUpdate(a, r.__s, x) === !1 || e.__v == t.__v) {
                for(e.__v != t.__v && (r.props = a, r.state = r.__s, r.__d = !1), e.__e = t.__e, e.__k = t.__k, e.__k.some(function(P) {
                    P && (P.__ = e);
                }), W = 0; W < r._sb.length; W++)r.__h.push(r._sb[W]);
                r._sb = [], r.__h.length && i.push(r);
                break e;
            }
            r.componentWillUpdate != null && r.componentWillUpdate(a, r.__s, x), h && r.componentDidUpdate != null && r.__h.push(function() {
                r.componentDidUpdate(c, m, g);
            });
        }
        if (r.context = x, r.props = a, r.__P = _, r.__e = !1, U = d.__r, J = 0, h) {
            for(r.state = r.__s, r.__d = !1, U && U(e), p = r.render(r.props, r.state, r.context), A = 0; A < r._sb.length; A++)r.__h.push(r._sb[A]);
            r._sb = [];
        } else do r.__d = !1, U && U(e), p = r.render(r.props, r.state, r.context), r.state = r.__s;
        while (r.__d && ++J < 25)
        r.state = r.__s, r.getChildContext != null && (o = k(k({}, o), r.getChildContext())), h && !v && r.getSnapshotBeforeUpdate != null && (g = r.getSnapshotBeforeUpdate(c, m)), T = p, p != null && p.type === I && p.key == null && (T = se(p.props.children)), u = oe(_, L(T) ? T : [
            T
        ], e, t, o, l, n, i, u, f, s), r.base = e.__e, e.__u &= -161, r.__h.length && i.push(r), y && (r.__E = r.__ = null);
    } catch (P) {
        if (e.__v = null, f || n != null) if (P.then) {
            for(e.__u |= f ? 160 : 128; u && u.nodeType == 8 && u.nextSibling;)u = u.nextSibling;
            n[n.indexOf(u)] = null, e.__e = u;
        } else {
            for(R = n.length; R--;)z(n[R]);
            O(e);
        }
        else e.__e = t.__e, e.__k = t.__k, P.then || O(e);
        d.__e(P, e, t);
    }
    else n == null && e.__v == t.__v ? (e.__k = t.__k, e.__e = t.__e) : u = e.__e = ve(t.__e, e, t, o, l, n, i, f, s);
    return (p = d.diffed) && p(e), 128 & e.__u ? void 0 : u;
}
function O(_) {
    _ && _.__c && (_.__c.__e = !0), _ && _.__k && _.__k.forEach(O);
}
function ie(_, e, t) {
    for(var o = 0; o < t.length; o++)G(t[o], t[++o], t[++o]);
    d.__c && d.__c(e, _), _.some(function(l) {
        try {
            _ = l.__h, l.__h = [], _.some(function(n) {
                n.call(l);
            });
        } catch (n) {
            d.__e(n, l.__v);
        }
    });
}
function se(_) {
    return typeof _ != "object" || _ == null || _.__b && _.__b > 0 ? _ : L(_) ? _.map(se) : k({}, _);
}
function ve(_, e, t, o, l, n, i, u, f) {
    var s, p, r, v, c, m, g, y = t.props, a = e.props, h = e.type;
    if (h == "svg" ? l = "http://www.w3.org/2000/svg" : h == "math" ? l = "http://www.w3.org/1998/Math/MathML" : l || (l = "http://www.w3.org/1999/xhtml"), n != null) {
        for(s = 0; s < n.length; s++)if ((c = n[s]) && "setAttribute" in c == !!h && (h ? c.localName == h : c.nodeType == 3)) {
            _ = c, n[s] = null;
            break;
        }
    }
    if (_ == null) {
        if (h == null) return document.createTextNode(a);
        _ = document.createElementNS(l, h, a.is && a), u && (d.__m && d.__m(e, n), u = !1), n = null;
    }
    if (h == null) y === a || u && _.data == a || (_.data = a);
    else {
        if (n = n && D.call(_.childNodes), y = t.props || M, !u && n != null) for(y = {}, s = 0; s < _.attributes.length; s++)y[(c = _.attributes[s]).name] = c.value;
        for(s in y)if (c = y[s], s != "children") {
            if (s == "dangerouslySetInnerHTML") r = c;
            else if (!(s in a)) {
                if (s == "value" && "defaultValue" in a || s == "checked" && "defaultChecked" in a) continue;
                F(_, s, null, c, l);
            }
        }
        for(s in a)c = a[s], s == "children" ? v = c : s == "dangerouslySetInnerHTML" ? p = c : s == "value" ? m = c : s == "checked" ? g = c : u && typeof c != "function" || y[s] === c || F(_, s, c, y[s], l);
        if (p) u || r && (p.__html == r.__html || p.__html == _.innerHTML) || (_.innerHTML = p.__html), e.__k = [];
        else if (r && (_.innerHTML = ""), oe(e.type == "template" ? _.content : _, L(v) ? v : [
            v
        ], e, t, o, h == "foreignObject" ? "http://www.w3.org/1999/xhtml" : l, n, i, n ? n[0] : t.__k && S(t, 0), u, f), n != null) for(s = n.length; s--;)z(n[s]);
        u || (s = "value", h == "progress" && m == null ? _.removeAttribute("value") : m != null && (m !== _[s] || h == "progress" && !m || h == "option" && m != y[s]) && F(_, s, m, y[s], l), s = "checked", g != null && g != _[s] && F(_, s, g, y[s], l));
    }
    return _;
}
function G(_, e, t) {
    try {
        if (typeof _ == "function") {
            var o = typeof _.__u == "function";
            o && _.__u(), o && e == null || (_.__u = _(e));
        } else _.current = e;
    } catch (l) {
        d.__e(l, t);
    }
}
function ue(_, e, t) {
    var o, l;
    if (d.unmount && d.unmount(_), (o = _.ref) && (o.current && o.current != _.__e || G(o, null, e)), (o = _.__c) != null) {
        if (o.componentWillUnmount) try {
            o.componentWillUnmount();
        } catch (n) {
            d.__e(n, e);
        }
        o.base = o.__P = null;
    }
    if (o = _.__k) for(l = 0; l < o.length; l++)o[l] && ue(o[l], e, t || typeof _.type != "function");
    t || z(_.__e), _.__c = _.__ = _.__e = void 0;
}
function me(_, e, t) {
    return this.constructor(_, t);
}
function ye(_, e, t) {
    var o, l, n, i;
    e == document && (e = document.documentElement), d.__ && d.__(_, e), l = (o = typeof t == "function") ? null : t && t.__k || e.__k, n = [], i = [], q(e, _ = (!o && t || e).__k = fe(I, null, [
        _
    ]), l || M, M, e.namespaceURI, !o && t ? [
        t
    ] : l ? null : e.firstChild ? D.call(e.childNodes) : null, n, !o && t ? t : l ? l.__e : e.firstChild, o, i), ie(n, _, i);
}
D = ne.slice, d = {
    __e: function(_, e, t, o) {
        for(var l, n, i; e = e.__;)if ((l = e.__c) && !l.__) try {
            if ((n = l.constructor) && n.getDerivedStateFromError != null && (l.setState(n.getDerivedStateFromError(_)), i = l.__d), l.componentDidCatch != null && (l.componentDidCatch(_, o || {}), i = l.__d), i) return l.__E = l;
        } catch (u) {
            _ = u;
        }
        throw _;
    }
}, Y = 0, N.prototype.setState = function(_, e) {
    var t;
    t = this.__s != null && this.__s != this.state ? this.__s : this.__s = k({}, this.state), typeof _ == "function" && (_ = _(k({}, t), this.props)), _ && k(t, _), _ != null && this.__v && (e && this._sb.push(e), B(this));
}, N.prototype.forceUpdate = function(_) {
    this.__v && (this.__e = !0, _ && this.__h.push(_), B(this));
}, N.prototype.render = I, C = [], Z = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, ee = function(_, e) {
    return _.__v.__b - e.__v.__b;
}, H.__r = 0, _e = /(PointerCapture)$|Capture$/i, V = 0, $ = X(!1), j = X(!0), 0;
var x = 0, b = Array.isArray;
function d1(t, e, r, f, n, s) {
    e || (e = {});
    var i, o, a = e;
    if ("ref" in a) for(o in a = {}, e)o == "ref" ? i = e[o] : a[o] = e[o];
    var l = {
        type: t,
        props: a,
        key: r,
        ref: i,
        __k: null,
        __: null,
        __b: 0,
        __e: null,
        __c: null,
        constructor: void 0,
        __v: --x,
        __i: -1,
        __u: 0,
        __source: n,
        __self: s
    };
    if (typeof t == "function" && (i = t.defaultProps)) for(o in i)a[o] === void 0 && (a[o] = i[o]);
    return d.vnode && d.vnode(l), l;
}
var c, o, d2, b1, v = 0, x1 = [], r = d, g = r.__b, C1 = r.__r, A = r.diffed, D1 = r.__c, F1 = r.unmount, k1 = r.__;
function l(t, _) {
    r.__h && r.__h(o, t, v || _), v = 0;
    var u = o.__H || (o.__H = {
        __: [],
        __h: []
    });
    return t >= u.__.length && u.__.push({}), u.__[t];
}
function B1(t) {
    return v = 1, I1(U, t);
}
function I1(t, _, u) {
    var n = l(c++, 2);
    if (n.t = t, !n.__c && (n.__ = [
        u ? u(_) : U(void 0, _),
        function(f) {
            var a = n.__N ? n.__N[0] : n.__[0], s = n.t(a, f);
            a !== s && (n.__N = [
                s,
                n.__[1]
            ], n.__c.setState({}));
        }
    ], n.__c = o, !o.__f)) {
        var i = function(f, a, s) {
            if (!n.__c.__H) return !0;
            var m = n.__c.__H.__.filter(function(e) {
                return !!e.__c;
            });
            if (m.every(function(e) {
                return !e.__N;
            })) return !h || h.call(this, f, a, s);
            var N = n.__c.props !== f;
            return m.forEach(function(e) {
                if (e.__N) {
                    var P = e.__[0];
                    e.__ = e.__N, e.__N = void 0, P !== e.__[0] && (N = !0);
                }
            }), h && h.call(this, f, a, s) || N;
        };
        o.__f = !0;
        var h = o.shouldComponentUpdate, E = o.componentWillUpdate;
        o.componentWillUpdate = function(f, a, s) {
            if (this.__e) {
                var m = h;
                h = void 0, i(f, a, s), h = m;
            }
            E && E.call(this, f, a, s);
        }, o.shouldComponentUpdate = i;
    }
    return n.__N || n.__;
}
function w(t, _) {
    var u = l(c++, 3);
    !r.__s && y(u.__H, _) && (u.__ = t, u.u = _, o.__H.__h.push(u));
}
function z1(t) {
    return v = 5, T(function() {
        return {
            current: t
        };
    }, []);
}
function T(t, _) {
    var u = l(c++, 7);
    return y(u.__H, _) && (u.__ = t(), u.__H = _, u.__h = t), u.__;
}
function S1() {
    for(var t; t = x1.shift();)if (t.__P && t.__H) try {
        t.__H.__h.forEach(p), t.__H.__h.forEach(H1), t.__H.__h = [];
    } catch (_) {
        t.__H.__h = [], r.__e(_, t.__v);
    }
}
r.__b = function(t) {
    o = null, g && g(t);
}, r.__ = function(t, _) {
    t && _.__k && _.__k.__m && (t.__m = _.__k.__m), k1 && k1(t, _);
}, r.__r = function(t) {
    C1 && C1(t), c = 0;
    var _ = (o = t.__c).__H;
    _ && (d2 === o ? (_.__h = [], o.__h = [], _.__.forEach(function(u) {
        u.__N && (u.__ = u.__N), u.u = u.__N = void 0;
    })) : (_.__h.forEach(p), _.__h.forEach(H1), _.__h = [], c = 0)), d2 = o;
}, r.diffed = function(t) {
    A && A(t);
    var _ = t.__c;
    _ && _.__H && (_.__H.__h.length && (x1.push(_) !== 1 && b1 === r.requestAnimationFrame || ((b1 = r.requestAnimationFrame) || W)(S1)), _.__H.__.forEach(function(u) {
        u.u && (u.__H = u.u), u.u = void 0;
    })), d2 = o = null;
}, r.__c = function(t, _) {
    _.some(function(u) {
        try {
            u.__h.forEach(p), u.__h = u.__h.filter(function(n) {
                return !n.__ || H1(n);
            });
        } catch (n) {
            _.some(function(i) {
                i.__h && (i.__h = []);
            }), _ = [], r.__e(n, u.__v);
        }
    }), D1 && D1(t, _);
}, r.unmount = function(t) {
    F1 && F1(t);
    var _, u = t.__c;
    u && u.__H && (u.__H.__.forEach(function(n) {
        try {
            p(n);
        } catch (i) {
            _ = i;
        }
    }), u.__H = void 0, _ && r.__e(_, u.__v));
};
var q1 = typeof requestAnimationFrame == "function";
function W(t) {
    var _, u = function() {
        clearTimeout(n), q1 && cancelAnimationFrame(_), setTimeout(t);
    }, n = setTimeout(u, 35);
    q1 && (_ = requestAnimationFrame(u));
}
function p(t) {
    var _ = o, u = t.__c;
    typeof u == "function" && (t.__c = void 0, u()), o = _;
}
function H1(t) {
    var _ = o;
    t.__c = t.__(), o = _;
}
function y(t, _) {
    return !t || t.length !== _.length || _.some(function(u, n) {
        return u !== t[n];
    });
}
function U(t, _) {
    return typeof _ == "function" ? _(t) : _;
}
const seen = new Set();
function reducer(s, a) {
    switch(a.t){
        case "user":
            return {
                items: [
                    ...s.items,
                    {
                        kind: "user",
                        text: a.text
                    }
                ],
                busy: true
            };
        case "assistant":
            {
                const items = s.items.slice();
                const last = items[items.length - 1];
                if (last?.kind === "assistant") items[items.length - 1] = {
                    kind: "assistant",
                    text: a.text
                };
                else items.push({
                    kind: "assistant",
                    text: a.text
                });
                return {
                    ...s,
                    items
                };
            }
        case "tool":
            if (seen.has("c" + a.id)) return s;
            seen.add("c" + a.id);
            return {
                ...s,
                items: [
                    ...s.items,
                    {
                        kind: "tool",
                        id: a.id,
                        name: a.name,
                        args: a.args
                    }
                ]
            };
        case "shot":
            if (seen.has("s" + a.id)) return s;
            seen.add("s" + a.id);
            return {
                ...s,
                items: [
                    ...s.items,
                    {
                        kind: "shot",
                        id: a.id,
                        src: a.src
                    }
                ]
            };
        case "endTurn":
            return s;
        case "done":
            return {
                ...s,
                busy: false
            };
        case "error":
            return {
                items: [
                    ...s.items,
                    {
                        kind: "tool",
                        id: "err" + Math.random(),
                        name: "error",
                        args: a.text
                    }
                ],
                busy: false
            };
    }
}
function App() {
    const [state, dispatch] = I1(reducer, {
        items: [],
        busy: false
    });
    const [meta, setMeta] = B1("connecting…");
    const [connected, setConnected] = B1(false);
    const sendRef = z1(()=>{});
    const logRef = z1(null);
    const [draft, setDraft] = B1("");
    function onEvent(m) {
        const renderMsg = (msg, freshTurn)=>{
            let text = "";
            for (const b of msg?.content ?? []){
                if (b.type === "text") text += b.text;
                else if (b.type === "toolCall" || b.type === "tool_use") {
                    dispatch({
                        t: "tool",
                        id: String(b.id ?? b.toolCallId ?? JSON.stringify(b.arguments ?? b.input)),
                        name: b.name ?? b.toolName,
                        args: JSON.stringify(b.arguments ?? b.input ?? {})
                    });
                }
            }
            if (text) dispatch({
                t: "assistant",
                text
            });
            if (freshTurn) {}
        };
        switch(m.type){
            case "hello":
                setMeta(`${m.model} · ${m.screen.join("×")}`);
                break;
            case "message_start":
            case "message_update":
            case "message_end":
                if (m.message) renderMsg(m.message, false);
                break;
            case "turn_end":
                if (m.message) renderMsg(m.message, false);
                for (const r of m.toolResults ?? []){
                    for (const b of r.content ?? []){
                        if (b.type === "image" && b.data) {
                            dispatch({
                                t: "shot",
                                id: (r.toolCallId ?? r.id ?? "") + b.data.length,
                                src: `data:${b.mimeType ?? "image/png"};base64,${b.data}`
                            });
                        }
                    }
                }
                break;
            case "agent_end":
                dispatch({
                    t: "done"
                });
                break;
            case "error":
                dispatch({
                    t: "error",
                    text: m.message
                });
                break;
        }
    }
    w(()=>{
        const w = window;
        if (w.bindings) {
            w.__ev = (s)=>onEvent(JSON.parse(s));
            setConnected(true);
            w.bindings.hello().then((h)=>{
                const x = JSON.parse(h);
                setMeta(`${x.model} · ${x.screen.join("×")}`);
            });
            sendRef.current = (t)=>w.bindings.sendMessage(t);
        } else {
            const es = new EventSource("/events");
            es.onopen = ()=>setConnected(true);
            es.onerror = ()=>setConnected(false);
            es.onmessage = (e)=>onEvent(JSON.parse(e.data));
            sendRef.current = (t)=>fetch("/chat", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json"
                    },
                    body: JSON.stringify({
                        message: t
                    })
                });
            return ()=>es.close();
        }
    }, []);
    w(()=>{
        const el = logRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [
        state.items
    ]);
    function submit() {
        const text = draft.trim();
        if (!text) return;
        dispatch({
            t: "user",
            text
        });
        setDraft("");
        sendRef.current(text);
    }
    return d1("div", {
        class: "app",
        children: [
            d1("header", {
                children: [
                    d1("span", {
                        class: "dot" + (connected ? " on" : "")
                    }),
                    "Codex Desktop",
                    d1("small", {
                        children: meta
                    })
                ]
            }),
            d1("div", {
                class: "log",
                ref: logRef,
                children: state.items.map((it, i)=>it.kind === "user" ? d1("div", {
                        class: "msg user",
                        children: it.text
                    }, i) : it.kind === "assistant" ? d1("div", {
                        class: "msg assistant",
                        children: it.text
                    }, i) : it.kind === "tool" ? d1("div", {
                        class: "msg tool",
                        children: [
                            d1("b", {
                                children: it.name === "error" ? "⚠️" : "🔧 " + it.name
                            }),
                            " ",
                            it.args
                        ]
                    }, i) : d1("div", {
                        class: "shot",
                        children: d1("img", {
                            src: it.src
                        })
                    }, i))
            }),
            d1("form", {
                onSubmit: (e)=>{
                    e.preventDefault();
                    submit();
                },
                children: [
                    d1("textarea", {
                        value: draft,
                        placeholder: "Ask, or tell it to do something on your Mac…",
                        onInput: (e)=>setDraft(e.target.value),
                        onKeyDown: (e)=>{
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }
                    }),
                    d1("button", {
                        disabled: state.busy,
                        children: "Send"
                    })
                ]
            })
        ]
    });
}
ye(d1(App, {}), document.getElementById("root"));
