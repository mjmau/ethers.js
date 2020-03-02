'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var assert_1 = __importDefault(require("assert"));
var ethers_1 = require("ethers");
var test_contract_json_1 = __importDefault(require("./test-contract.json"));
var provider = new ethers_1.ethers.providers.InfuraProvider('rinkeby');
var TIMEOUT_PERIOD = 120000;
var contract = (function () {
    return new ethers_1.ethers.Contract(test_contract_json_1.default.contractAddress, test_contract_json_1.default.interface, provider);
})();
function equals(name, actual, expected) {
    if (Array.isArray(expected)) {
        assert_1.default.equal(actual.length, expected.length, 'array length mismatch - ' + name);
        expected.forEach(function (expected, index) {
            equals(name + ':' + index, actual[index], expected);
        });
        return;
    }
    if (typeof (actual) === 'object') {
        if (expected.indexed) {
            assert_1.default.ok(ethers_1.ethers.Contract.isIndexed(actual), 'index property has index - ' + name);
            if (expected.hash) {
                assert_1.default.equal(actual.hash, expected.hash, 'index property with known hash matches - ' + name);
            }
            return;
        }
        if (actual.eq) {
            assert_1.default.ok(actual.eq(expected), 'numeric value matches - ' + name);
        }
    }
    assert_1.default.equal(actual, expected, 'value matches - ' + name);
}
function TestContractEvents() {
    return ethers_1.ethers.utils.fetchJson('https://api.ethers.io/api/v1/?action=triggerTest&address=' + contract.address).then(function (data) {
        console.log('  *** Triggered Transaction Hash: ' + data.hash);
        contract.on("error", function (error) {
            console.log(error);
            assert_1.default(false);
            contract.removeAllListeners();
        });
        function waitForEvent(eventName, expected) {
            return new Promise(function (resolve, reject) {
                var done = false;
                contract.on(eventName, function () {
                    if (done) {
                        return;
                    }
                    done = true;
                    var args = Array.prototype.slice.call(arguments);
                    var event = args.pop();
                    event.removeListener();
                    equals(event.event, args, expected);
                    resolve();
                });
                var timer = setTimeout(function () {
                    if (done) {
                        return;
                    }
                    done = true;
                    contract.removeAllListeners();
                    reject(new Error("timeout"));
                }, TIMEOUT_PERIOD);
                if (timer.unref) {
                    timer.unref();
                }
            });
        }
        return new Promise(function (resolve, reject) {
            var p0 = '0x06B5955A67D827CDF91823E3bB8F069e6c89c1D6';
            var p0_1 = '0x06b5955A67d827CdF91823e3Bb8F069e6C89C1d7';
            var p1 = 0x42;
            var p1_1 = 0x43;
            return Promise.all([
                waitForEvent('Test', [p0, p1]),
                waitForEvent('TestP0', [p0, p1]),
                waitForEvent('TestP0P1', [p0, p1]),
                waitForEvent('TestIndexedString', [{ indexed: true, hash: '0x7c5ea36004851c764c44143b1dcb59679b11c9a68e5f41497f6cf3d480715331' }, p1]),
                waitForEvent('TestV2', [{ indexed: true }, [p0, p1]]),
                waitForEvent('TestV2Nested', [{ indexed: true }, [p0_1, p1_1, [p0, p1]]]),
            ]).then(function (result) {
                resolve();
            });
        });
    });
}
describe('Test Contract Objects', function () {
    it('parses events', function () {
        this.timeout(TIMEOUT_PERIOD);
        return TestContractEvents();
    });
    it('ABIv2 parameters and return types work', function () {
        this.timeout(TIMEOUT_PERIOD);
        var p0 = '0x06B5955A67D827CDF91823E3bB8F069e6c89c1D6';
        var p0_0f = '0x06B5955a67d827cDF91823e3bB8F069E6c89c1e5';
        var p0_f0 = '0x06b5955a67D827CDF91823e3Bb8F069E6C89c2C6';
        var p1 = 0x42;
        var p1_0f = 0x42 + 0x0f;
        var p1_f0 = 0x42 + 0xf0;
        var expectedPosStruct = [p0_f0, p1_f0, [p0_0f, p1_0f]];
        var seq = Promise.resolve();
        [
            [p0, p1, [p0, p1]],
            { p0: p0, p1: p1, child: [p0, p1] },
            [p0, p1, { p0: p0, p1: p1 }],
            { p0: p0, p1: p1, child: { p0: p0, p1: p1 } }
        ].forEach(function (struct) {
            seq = seq.then(function () {
                return contract.testV2(struct).then(function (result) {
                    equals('position input', result, expectedPosStruct);
                    equals('keyword input p0', result.p0, expectedPosStruct[0]);
                    equals('keyword input p1', result.p1, expectedPosStruct[1]);
                    equals('keyword input child.p0', result.child.p0, expectedPosStruct[2][0]);
                    equals('keyword input child.p1', result.child.p1, expectedPosStruct[2][1]);
                });
            });
        });
        return seq;
    });
    it('collapses single argument solidity methods', function () {
        this.timeout(TIMEOUT_PERIOD);
        return contract.testSingleResult(4).then(function (result) {
            assert_1.default.equal(result, 5, 'single value returned');
        });
    });
    it('does not collapses multi argument solidity methods', function () {
        this.timeout(TIMEOUT_PERIOD);
        return contract.testMultiResult(6).then(function (result) {
            assert_1.default.equal(result[0], 7, 'multi value [0] returned');
            assert_1.default.equal(result[1], 8, 'multi value [1] returned');
            assert_1.default.equal(result.r0, 7, 'multi value [r0] returned');
            assert_1.default.equal(result.r1, 8, 'multi value [r1] returned');
        });
    });
});
