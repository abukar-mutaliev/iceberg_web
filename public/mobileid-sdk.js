/**
 * MobileID SDK v1.0.0
 *
 * JS SDK для верификации телефона через MobileID.
 * UMD: работает как ES Module (import), CommonJS (require) и через <script> тег (window.MobileID).
 *
 * @example
 * // ES Module
 * import { MobileID } from 'mobileid-sdk';
 *
 * // CommonJS
 * const { MobileID } = require('mobileid-sdk');
 *
 * // <script>
 * <script src="mobileid-sdk.js"></script>
 * const mid = new MobileID({ tokenUrl: '/api/token' });
 *
 * @license MIT
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MobileID = factory().MobileID;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ==========================================================================
   * Конфигурация
   * ========================================================================== */

  /**
   * URL backend по умолчанию.
   * Переопределяется через MobileID.configure({ baseUrl }) или в конструкторе.
   * @private
   */
  var _globalBaseUrl = 'https://midsdk.smsaero.ru';

  /* ==========================================================================
   * Нормализация телефона
   * ========================================================================== */

  /**
   * Правила нормализации по странам.
   * Для добавления новой страны — добавить ключ с code, prefix, length, normalize.
   */
  var PHONE_RULES = {
    RU: {
      code: 'RU',
      prefix: '7',
      length: 11,
      /**
       * Нормализация для РФ:
       * - Убирает всё кроме цифр
       * - 8XXXXXXXXXX → 7XXXXXXXXXX
       * - 9XXXXXXXXX (10 цифр) → 79XXXXXXXXX
       * - Проверяет: начинается на 7, длина 11
       *
       * Критично: внешний API делает аналогичную нормализацию,
       * а подпись callback зависит от номера — они должны совпадать.
       *
       * @param {string} raw — введённый номер в любом формате
       * @returns {string|null} — 11 цифр начиная с 7, или null при ошибке
       */
      normalize: function (raw) {
        var digits = raw.replace(/\D/g, '');

        if (digits.length === 11 && digits.charAt(0) === '8') {
          digits = '7' + digits.substring(1);
        }

        if (digits.length === 10 && digits.charAt(0) === '9') {
          digits = '7' + digits;
        }

        if (digits.length !== 11) {
          return null;
        }

        if (digits.charAt(0) !== '7') {
          return null;
        }

        return digits;
      }
    }
  };

  /**
   * Нормализация номера телефона.
   *
   * @param {string} phone — номер в любом формате
   * @param {string} country — код страны (например 'RU')
   * @returns {{ phone: string } | { error: string }}
   */
  function normalizePhone(phone, country) {
    var rule = PHONE_RULES[country];
    if (!rule) {
      return { error: 'Unsupported country: ' + country };
    }
    var normalized = rule.normalize(phone);
    if (!normalized) {
      return { error: 'Invalid phone number for ' + country };
    }
    return { phone: normalized };
  }

  /* ==========================================================================
   * Fingerprint
   * ========================================================================== */

  /**
   * Собирает fingerprint браузера и возвращает SHA-256 хеш.
   * Используется для привязки сессии к устройству (session bind).
   *
   * @returns {Promise<string>} hex-строка SHA-256
   */
  function collectFingerprint() {
    var components = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.deviceMemory || '',
      ('ontouchstart' in window) ? 'touch' : 'no-touch'
    ];

    var raw = components.join('|');

    if (window.crypto && window.crypto.subtle) {
      var encoder = new TextEncoder();
      return window.crypto.subtle.digest('SHA-256', encoder.encode(raw)).then(function (buffer) {
        return bufferToHex(new Uint8Array(buffer));
      });
    }

    // Fallback для HTTP / старых браузеров
    return Promise.resolve(simpleHash(raw));
  }

  function bufferToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /* ==========================================================================
   * HTTP
   * ========================================================================== */

  /**
   * @param {string} method
   * @param {string} url
   * @param {Object} [body]
   * @returns {Promise<Object>}
   * @private
   */
  function request(method, url, body) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 35000; // чуть больше long poll timeout

      xhr.onload = function () {
        var data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = { error: xhr.responseText };
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject({ status: xhr.status, data: data });
        }
      };

      xhr.onerror = function () {
        reject({ status: 0, data: { error: 'Network error' } });
      };

      xhr.ontimeout = function () {
        reject({ status: 0, data: { error: 'Request timeout' } });
      };

      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  /* ==========================================================================
   * MobileID
   * ========================================================================== */

  /**
   * MobileID SDK.
   *
   * @param {Object} options
   * @param {string} options.tokenUrl — URL клиентского backend для получения init-токена
   * @param {string} [options.baseUrl] — URL MobileID backend (переопределяет глобальный)
   * @param {string} [options.country='RU'] — код страны для нормализации
   *
   * @fires MobileID#ready — сессия создана
   * @fires MobileID#pending — верификация запущена
   * @fires MobileID#otp_required — нужен OTP-код
   * @fires MobileID#verified — верификация пройдена
   * @fires MobileID#rejected — верификация отклонена
   * @fires MobileID#expired — сессия внешнего API истекла
   * @fires MobileID#invalid_code — неверный OTP, можно повторить
   * @fires MobileID#error — ошибка
   */
  function MobileID(options) {
    if (!options || !options.tokenUrl) {
      throw new Error('MobileID: tokenUrl is required');
    }

    this._tokenUrl = options.tokenUrl;
    this._baseUrl = (options.baseUrl || _globalBaseUrl).replace(/\/+$/, '');
    this._country = options.country || 'RU';

    this._listeners = {};
    this._sessionId = null;
    this._fingerprintHash = null;
    this._phone = null;
    this._lastPhone = null;
    this._pollAbort = null;
    this._polling = false;
    this._destroyed = false;
    this._retryCount = 0;
    this._lastEventId = 0;
    this._state = 'idle'; // idle | ready | pending | otp | final
  }

  /* --------------------------------------------------------------------------
   * Глобальная конфигурация
   * ------------------------------------------------------------------------ */

  /**
   * Глобальная настройка — переопределяет baseUrl по умолчанию.
   * Вызывать до создания экземпляров.
   *
   * @param {Object} config
   * @param {string} [config.baseUrl]
   */
  MobileID.configure = function (config) {
    if (config && config.baseUrl) {
      _globalBaseUrl = config.baseUrl.replace(/\/+$/, '');
    }
  };

  /* --------------------------------------------------------------------------
   * Event emitter
   * ------------------------------------------------------------------------ */

  /**
   * Подписаться на событие.
   * @param {string} event
   * @param {Function} callback
   * @returns {MobileID} this
   */
  MobileID.prototype.on = function (event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return this;
  };

  /**
   * Отписаться от события.
   * @param {string} event
   * @param {Function} callback
   * @returns {MobileID} this
   */
  MobileID.prototype.off = function (event, callback) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(function (cb) {
      return cb !== callback;
    });
    return this;
  };

  /** @private */
  MobileID.prototype._emit = function (event, data) {
    var callbacks = this._listeners[event];
    if (!callbacks) return;
    for (var i = 0; i < callbacks.length; i++) {
      try {
        callbacks[i](data);
      } catch (e) {
        console.error('MobileID event handler error:', e);
      }
    }
  };

  /* --------------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------------ */

  /**
   * Инициализация: fingerprint → токен → сессия.
   * Вызывать перед каждым новым циклом верификации
   * (в т.ч. при повторной попытке после rejected/expired/error).
   *
   * @returns {Promise<void>}
   */
  MobileID.prototype.init = function () {
    var self = this;

    // Сброс предыдущего цикла
    this._stopPolling();
    this._sessionId = null;
    this._phone = null;
    this._destroyed = false;
    this._lastEventId = 0;
    this._state = 'idle';

    return collectFingerprint()
      .then(function (fp) {
        self._fingerprintHash = fp;
        return request('POST', self._tokenUrl, { fingerprint_hash: fp });
      })
      .then(function (resp) {
        if (!resp.token) {
          throw { status: 0, data: { error: 'No token in response from tokenUrl' } };
        }
        return request('POST', self._baseUrl + '/api/session/init', {
          token: resp.token,
          fingerprint_hash: self._fingerprintHash
        });
      })
      .then(function (resp) {
        if (!resp.session_id) {
          throw { status: 0, data: { error: 'No session_id in init response' } };
        }
        self._sessionId = resp.session_id;
        self._state = 'ready';
        self._retryCount = 0;
        self._emit('ready', { session_id: resp.session_id });
      })
      .catch(function (err) {
        self._emitError('INIT_FAILED', err);
        throw err;
      });
  };

  /**
   * Запуск верификации номера.
   * Номер автоматически нормализуется по правилам страны.
   *
   * Backend может вернуть синхронизированный статус (если на этот номер
   * уже была верификация) — SDK обработает его и выбросит нужное событие.
   *
   * @param {string} phone — номер в любом формате
   * @returns {Promise<void>}
   */
  MobileID.prototype.start = function (phone) {
    var self = this;

    if (!this._sessionId) {
      return Promise.reject(new Error('MobileID: call init() first'));
    }

    var result = normalizePhone(phone, this._country);
    if (result.error) {
      this._emit('error', { code: 'INVALID_PHONE', message: result.error });
      return Promise.reject(new Error(result.error));
    }

    this._phone = result.phone;
    this._lastPhone = result.phone;

    return request('POST', this._baseUrl + '/api/session/' + this._sessionId + '/start', {
      phone: this._phone,
      fingerprint_hash: this._fingerprintHash
    })
      .then(function (resp) {
        var status = resp.status || 'pending';
        self._retryCount = 0;

        // Backend может вернуть синхронизированный статус
        // если на этот номер уже была верификация.
        // Во всех случаях эмитим pending и запускаем polling —
        // он вернёт актуальные события из сессии немедленно.
        switch (status) {
          case 'otp_required':
            self._state = 'otp';
            break;
          case 'verified':
          case 'rejected':
            self._state = 'final';
            break;
          default: // pending
            self._state = 'pending';
            break;
        }
        self._emit('pending', { phone: self._phone });
        self._startPolling();
      })
      .catch(function (err) {
        self._emitError('START_FAILED', err);
        throw err;
      });
  };

  /**
   * Отправка OTP-кода.
   * Можно вызывать повторно при invalid_code.
   *
   * При успешном коде событие verified приходит сразу в ответе,
   * без ожидания callback.
   *
   * @param {string} code
   * @returns {Promise<void>}
   */
  MobileID.prototype.submitOTP = function (code) {
    var self = this;

    if (!this._sessionId) {
      return Promise.reject(new Error('MobileID: no active session'));
    }

    return request('POST', this._baseUrl + '/api/session/' + this._sessionId + '/otp', {
      code: code,
      fingerprint_hash: this._fingerprintHash
    })
      .then(function (resp) {
        switch (resp.status) {
          case 'verified':
            self._stopPolling();
            self._state = 'final';
            self._emit('verified', {
              verify_token: resp.event && resp.event.data
                ? resp.event.data.verify_token
                : null
            });
            break;

          case 'invalid_code':
            self._emit('invalid_code', {
              message: resp.message || 'Invalid code'
            });
            break;

          case 'session_expired':
            self._stopPolling();
            self._state = 'final';
            self._emit('expired', {
              verify_token: resp.event && resp.event.data
                ? resp.event.data.verify_token
                : null
            });
            break;

          default:
            // Не финальный — событие придёт через polling
            break;
        }
      })
      .catch(function (err) {
        self._emitError('OTP_FAILED', err);
        throw err;
      });
  };

  /**
   * Тихая перезагрузка: init → start с запомненным номером.
   * Вызывается автоматически при ошибках polling.
   *
   * @returns {Promise<void>}
   */
  MobileID.prototype.silentRetry = function () {
    var self = this;
    this._retryCount++;
    var phone = this._lastPhone;

    return this.init()
      .then(function () {
        if (phone) {
          return self.start(phone);
        }
      })
      .catch(function () {
        // Ошибки уже обработаны через события
      });
  };

  /**
   * Нормализация номера без запуска верификации.
   * Для валидации в UI перед вызовом start().
   *
   * @param {string} phone
   * @param {string} [country] — по умолчанию из конструктора
   * @returns {{ phone: string } | { error: string }}
   */
  MobileID.prototype.normalizePhone = function (phone, country) {
    return normalizePhone(phone, country || this._country);
  };

  /** Нормализованный номер после start(). @returns {string|null} */
  MobileID.prototype.getPhone = function () { return this._phone; };

  /** ID текущей сессии. @returns {string|null} */
  MobileID.prototype.getSessionId = function () { return this._sessionId; };

  /** Fingerprint hash. @returns {string|null} */
  MobileID.prototype.getFingerprintHash = function () { return this._fingerprintHash; };

  /** Текущее состояние: idle | ready | pending | otp | final. @returns {string} */
  MobileID.prototype.getState = function () { return this._state; };

  /** Текущие количество попыток ввода otp кода. @returns {int} */
  MobileID.prototype.getRetryCount = function () { return this._retryCount; };

  /**
   * Уничтожить: остановить polling, очистить состояние.
   * После вызова нужен новый init() или новый экземпляр.
   */
  MobileID.prototype.destroy = function () {
    this._destroyed = true;
    this._stopPolling();
    this._sessionId = null;
    this._phone = null;
    this._fingerprintHash = null;
    this._listeners = {};
    this._state = 'idle';
  };

  /* --------------------------------------------------------------------------
   * Long polling
   * ------------------------------------------------------------------------ */

  /** @private */
  MobileID.prototype._startPolling = function () {
    this._stopPolling();
    this._poll();
  };

  /** @private */
  MobileID.prototype._stopPolling = function () {
    this._polling = false;
    if (this._pollAbort) {
      this._pollAbort.abort = true;
    }
  };

  /** @private */
  MobileID.prototype._poll = function () {
    if (this._destroyed || !this._sessionId) return;

    var self = this;
    this._polling = true;

    var abort = { abort: false };
    this._pollAbort = abort;

    var url = this._baseUrl
      + '/api/session/' + this._sessionId
      + '/events?last_event_id=' + this._lastEventId
      + '&fingerprint_hash=' + encodeURIComponent(this._fingerprintHash);

    request('GET', url)
      .then(function (resp) {
        if (abort.abort || self._destroyed) return;

        var events = resp.events || [];
        for (var i = 0; i < events.length; i++) {
          var ev = events[i];
          if (ev.id > self._lastEventId) {
            self._lastEventId = ev.id;
          }
          self._handleEvent(ev);
        }

        // Продолжаем если не остановлен
        if (self._polling && !self._destroyed) {
          self._poll();
        }
      })
      .catch(function (err) {
        if (abort.abort || self._destroyed) return;

        // Ошибка polling → silent retry всего цикла
        if (self._polling && !self._destroyed) {
          self._stopPolling();
          setTimeout(function () {
            if (!self._destroyed) {
              self.silentRetry();
            }
          }, 1500);
        }
      });
  };

  /** @private */
  MobileID.prototype._handleEvent = function (ev) {
    switch (ev.type) {
      case 'otp_required':
        this._state = 'otp';
        this._retryCount = 0;
        this._emit('otp_required', {});
        break;

      case 'verified':
        this._stopPolling();
        this._state = 'final';
        this._emit('verified', {
          verify_token: ev.data ? ev.data.verify_token : null
        });
        break;

      case 'rejected':
        this._stopPolling();
        this._state = 'final';
        this._emit('rejected', {
          verify_token: ev.data ? ev.data.verify_token : null
        });
        break;

      case 'session_expired':
        this._stopPolling();
        this._state = 'final';
        this._emit('expired', {
          verify_token: ev.data ? ev.data.verify_token : null
        });
        break;

      default:
        // Неизвестное событие → silent retry
        this._stopPolling();
        this.silentRetry();
        break;
    }
  };

  /** @private */
  MobileID.prototype._emitError = function (code, err) {
    var message = 'Unknown error';
    if (err && err.data && err.data.error) {
      message = err.data.error;
    } else if (err && err.message) {
      message = err.message;
    }
    this._emit('error', {
      code: code,
      message: message,
      status: err ? err.status : 0
    });
  };

  /* --------------------------------------------------------------------------
   * Static methods
   * ------------------------------------------------------------------------ */

  /**
   * Список поддерживаемых стран.
   * @returns {Array<{code: string, prefix: string, length: number}>}
   */
  MobileID.countries = function () {
    return Object.keys(PHONE_RULES).map(function (key) {
      var rule = PHONE_RULES[key];
      return { code: rule.code, prefix: rule.prefix, length: rule.length };
    });
  };

  /**
   * Нормализация номера (статический метод).
   * @param {string} phone
   * @param {string} country
   * @returns {{ phone: string } | { error: string }}
   */
  MobileID.normalizePhone = normalizePhone;

  /* ==========================================================================
   * Export
   * ========================================================================== */

  return { MobileID: MobileID };

}));
